import { ApiClient } from "./modules/api.mjs";
import ExcelJS from "exceljs";
import dayjs from "dayjs";
import fs from "fs";
import * as readline from 'readline';

// Console format codes, ignore
const cyan = "\x1b[36m";
const yellow = "\x1b[33m";
const red = "\x1b[31m";
const bold = "\x1b[1m";
const reset = "\x1b[0m";

const tickets_file = "tickets.txt"; //Ticket IDs are separated by newlines
const excel_file = "tickets.xlsx"; // Overwrites! be careful

// Setup
const client = new ApiClient();
const ticket_ids = injest_ticket_ids(tickets_file);
console.log(`${cyan}Found ${ticket_ids.length} tickets in ${tickets_file}${reset}`);

// Get the tickets as an array of objects and convert them to excel rows
var tickets = [];
updateConsoleMsg();
for (const id of ticket_ids) {
    let ticket = await client.fetchTicket(id);
    tickets.push(ticket_object_to_row(ticket));
    updateConsoleMsg();
}
updateConsoleMsg();
console.log();

// Write to excel document
const book = new ExcelJS.Workbook();
const sheet = book.addWorksheet();

for (const ticket of tickets) {
    sheet.addRow(ticket);
}

var busy = true;
while (busy) {
    busy = false;
    try {
        await book.xlsx.writeFile(excel_file);
    } catch(error) {
        if (error.code === "EBUSY") {
            busy = true;
            updateBusyMsg();
            sleep(500);
        }
    }    
}

console.log(`\n${cyan}Wrote ${tickets.length} tickets to ${excel_file}${reset}`);



/**
 * Reads ticket IDs from `path` and returns them as a `string[]`
 * 
 * The file at `path` must be formatted using utf8, and contain a list of ticket IDs separated by Windows newline `/r/n`.
 * 
 * @param {string} path - The path to get ticket IDs from
 * @returns {string[]} An array of ticketIDs
 */
function injest_ticket_ids(path) {
    const data = fs.readFileSync(path, 'utf8');
    return data.split('\r\n');
}

/**
 * Takes a ticket object return from the `ApiClient.fetchTicket()` and converts it into a row format suitable for excel
 * 
 * @param {*} ticket - Ticket object to be converted into a row
 * @returns {*[]} Ticket formatted as a row
 */
function ticket_object_to_row(ticket) {
    return [
        dayjs(ticket.date).format("MM/DD/YYYY"),
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
        ticket.requestor
    ]
}

function updateConsoleMsg() {
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0, null);
    process.stdout.write(`${yellow}Downloading tickets (${tickets.length}/${ticket_ids.length})${cyan}\tAPI tokens: ${client.tokens}\tnext refresh: ${calcTimeToTokenRefresh(client).toFixed(0)}s${reset}`);
}

function updateBusyMsg() {
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0, null);
    process.stderr.write(`${red}Please close ${excel_file} to continue.${reset}`);
}

function calcTimeToTokenRefresh(client) {
    if ((client.lastRefresh === undefined) || ((Date.now() - client.lastRefresh) / 1000 >= 60)) {
        return 0;
    } else {
        return 60 - ((Date.now() - client.lastRefresh) / 1000)
    }
}

function sleep(ms) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}