import { ApiClient } from "./modules/api_client.mjs";
import ExcelJS from "exceljs";
import dayjs from "dayjs";
import fs from "fs";
import * as readline from 'readline';
import { exit } from "process";

// Console format codes, for coloring console output
const cyan = "\x1b[36m";
const yellow = "\x1b[33m";
const red = "\x1b[31m";
const bold = "\x1b[1m";
const reset = "\x1b[0m";

// Change these filenames if you want to
const tickets_file = "tickets.txt"; //Ticket IDs are separated by newlines
const excel_file = "tickets.xlsx"; // Overwrites without warning! be careful

const client = new ApiClient();

// load ticket IDs
const ticket_ids = load_ticket_ids(tickets_file);
if (ticket_ids[0].length === 0) {
    error(`Error: No ticket IDs found in ${tickets_file}`);
}
console.log(`${cyan}Found ${ticket_ids.length} tickets in ${tickets_file}${reset}`);

// Download the tickets as an array of objects then convert them to excel rows
var tickets = [];
update_console_msg();
for (const id of ticket_ids) {
    let ticket = await client.fetch_ticket(id);
    tickets.push(ticket_object_to_row(ticket));
    update_console_msg();
}
update_console_msg();
console.log(); // newline

// Write to excel document
const book = new ExcelJS.Workbook();
const sheet = book.addWorksheet();

for (const ticket of tickets) {
    sheet.addRow(ticket);
}

// If document is open, loop until it is closed
var busy = true;
while (busy) {
    busy = false;
    try {
        await book.xlsx.writeFile(excel_file);
    } catch(err) {
        if (err.code === "EBUSY") {
            busy = true;
            update_busy_msg();
            sleep(500);
        }
    }    
}

console.log(`\n${cyan}Wrote ${tickets.length} tickets to ${excel_file}${reset}`);



/**
 * Reads ticket IDs from `path` and returns them as a `string[]`
 * 
 * The file at `path` must be formatted using utf8, and contain a list of ticket IDs separated by line.
 * Blank lines will automatically be removed. Invalid ticket IDs will throw an error.
 * May return an empty array.
 * 
 * @param {string} path - The path to get ticket IDs from
 * @returns {string[]} An array of ticketIDs
 */
function load_ticket_ids(path) {
    const ticket_id_reg_exp = /^[0-9]{8}$/; // For validation

    try {
        // Read data
        const data = fs.readFileSync(path, 'utf8');
        const lines = data.split(/\r?\n/);

        // Validate input
        var ticket_ids = [];
        for (const [i, line] of lines.entries()) {
            if (line === "") continue;
            if (!ticket_id_reg_exp.test(line)) {
                throw new Error(`Invalid ticket ID: ${line} (line ${i+1})`);
            }
            ticket_ids.push(line);
        }
        return ticket_ids;

    } catch(err) {
        if (err.code === "ENOENT") {
            error(`Could not find file ${path}`);
        } else {
            error(err);
        }
    }
}

/**
 * Takes a ticket object returned from `ApiClient.fetchTicket()` and converts it into a row format suitable for excel
 * 
 * @param {*} ticket - Ticket object to be converted into a row
 * @returns {*[]} Ticket formatted as a row
 */
function ticket_object_to_row(ticket) {
    const date_created = dayjs(ticket.date).format("MM/DD/YYYY");
    const summary = parse_summary(ticket.summary);

    return [
        date_created,
        ticket.rush,
        ticket.id,
        ticket.vendor,
        ticket.status,
        ticket.product,
        ticket.description,
        ticket.isRenewal,
        ticket.swType,
        ticket.infoClass,
        ticket.quantity,
        ticket.techCoordinator,
        ticket.requestor,
        summary.date_completed,
        summary.reviewed_by,
        ticket.risk,
        "",
        summary.notes
    ]
}


/**
 * Used to update a line in the console
 */
function update_console_msg() {
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0, null);
    process.stdout.write(`${yellow}Downloading tickets (${tickets.length}/${ticket_ids.length})${cyan}\tAPI tokens: ${client.tokens}\tnext refresh: ${calc_time_to_token_refresh(client).toFixed(0)}s${reset}`);
}

/**
 * Used to update a line in the console
 */
function update_busy_msg() {
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0, null);
    process.stderr.write(`${red}Please close ${excel_file} to continue.${reset}`);
}

/**
 * Takes an `ApiClient` instance and returns the number of seconds until its next API token refresh.
 * 
 * @param {ApiClient} client An instance of `ApiClient`
 * @returns {number} Time until `client`'s next API token refresh, in seconds
 */
function calc_time_to_token_refresh(client) {
    if ((client.lastRefresh === undefined) || ((Date.now() - client.lastRefresh) / 1000 >= 60)) {
        return 0;
    } else {
        return 60 - ((Date.now() - client.lastRefresh) / 1000)
    }
}

/**
 * Pauses execution for the given number of milliseconds
 * 
 * @param {number} ms Amount of time to sleep in milliseconds
 */
function sleep(ms) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Prints `msg` to stderr and quits with exit code `1`.
 * @param {string} msg The error message to print
 */
function error(msg) {
    console.error(`${red}${msg}${reset}`);
    exit(1)
}

/**
 * Parses the DoIT Security SME Summary for logging
 * 
 * I'm so sorry about this function. It's just regex hell. Use https://regex101.com/ to see what the regex does (if you *really* need to know).
 * @param {string} summary The DoIT Security SME Summary from a ticket
 * @return {{
 * reviewed_by: string,
 * notes: string,
 * }} Parsed summary object
 */
function parse_summary(summary) {
    const notes_reg_exp = /.*?(?=(\r\n)*Reviewed by:)/;
    const reviewed_by_reg_exp = /(?<=Reviewed by:  ).*?(?=\r\n)/;
    const date_completed_reg_exp = /(?<=Date: ).*?(?=\s|$)/;

    const notes = summary.match(notes_reg_exp) ?? [""];
    const reviewed_by = summary.match(reviewed_by_reg_exp) ?? [""];
    const date_completed = summary.match(date_completed_reg_exp) ?? [""];

    reviewed_by[0] = reviewed_by[0].replace(/[^A-Z].*?(?=\s)/, ".").replace("-SA", "").replace(/(?<=\/[A-Z]).*?(?=\s)/, ".");

    return {
        reviewed_by: reviewed_by[0],
        notes: notes[0],
        date_completed: date_completed[0],
    }
}