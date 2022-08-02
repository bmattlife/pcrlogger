import fetch from "node-fetch";
import { constants } from "./constants.mjs";
import dotenv from 'dotenv';
import fs from "fs";

const MAX_TOKENS = 50;

/**
 * An API client for TeamDynamix with support for API tokens.
 * 
 * API tokens are managed by the client to prevent overwhelming the server.
 * The number of starting tokens is determined by `MAX_TOKENS`, and each request will subtract one token from the total.
 * Every 60 seconds, the token count will refresh.
 *  
 * The `TDX_KEY` environment variable must be set prior to constructing an instance of this class.
 */
export class ApiClient {

    #TDX_KEY;
    tokens;
    lastRefresh;
    lastRequestTimestamp;
    refreshCallback;

    constructor() {
        dotenv.config();
        this.#TDX_KEY = process.env.TDX_KEY;
        if (this.#TDX_KEY == undefined) {
            error('ERROR: Remember to set an API key.');
        }
        this.tokens = 0;
    }

    async get(path) {
        this.consume_token();
        const headers = {
            Accept: 'application/json',
            Authorization: 'Bearer ' + this.#TDX_KEY
        }

        const response = await fetch(constants.API + path, { headers: headers });
        if (!response.ok) {
            throw new Error(response.status + ' ' + response.statusText + ': ' + path);
        }
        else {
            return response.json();
        }
    }

    async post(path, data) {
        return fetch(constants.API + path, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                Authorization: 'Bearer ' + this.#TDX_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
            .then(res => {
                if (!res.ok) {
                    throw new Error(res.status + ' ' + res.statusText + ': ' + path);
                }
                else {
                    return res.json();
                }
            })
    }

    async get_ticket(ticketID) {
        return await this.get(`641/tickets/${ticketID}`);
    }

    async search_tickets(query) {
        return await this.post('641/tickets/search', query);
    }

    async get_feed(ticketID) {
        return await this.get(`641/tickets/${ticketID}/feed`);
    }

    get_percent_complete(ticket) {
        if (ticket.Tasks.length === 0) return;
        const securityTask = ticket.Tasks.find(task => task.Title === 'PCR Security');
        if (!securityTask) return;
        else {
            return securityTask.PercentComplete;
        }
    }

    async fetch_ticket(id) {
        const ticket = this.get('641/tickets/' + id)
            .then(json => {
                const date = json.CreatedDate;
                const rush = "";
                const id = json.ID;
                let vendor = json.Attributes.find(attr => attr.Name === 'Vendor')?.ValueText;
                const status = json.StatusName;
                const product = json.Title;
                const description = '';
                const isRenewal = json.Attributes.find(attr => attr.Name === 'Renewal')?.ValueText === 'Yes' ? 'Renewal' : 'New';
                const techType = json.Attributes.find(attr => attr.Name === 'Technology Type')?.ValueText;
                let swType = json.Attributes.find(attr => attr.Name === 'Software Type');
                swType = swType === undefined ? '' : swType.ValueText;
                swType = swType.toLowerCase().includes("web application") ? "SaaS" : swType;
                swType = swType.toLowerCase().includes("desktop application") ? "App" : swType;
                swType = swType.toLowerCase().includes("mobile device application") ? "App" : swType;
                swType = swType.toLowerCase().includes("system software") ? "SaaS" : swType;
                let infoClass = json.Attributes.find(attr => attr.Name === 'Information Classification Standard')?.ValueText;
                if (infoClass.startsWith('No')) { infoClass = 'No Level 1,2,3'; }
                else if (infoClass.startsWith('Level')) { infoClass = 'Level ' + infoClass.at(6) }
                const qtyStudents = json.Attributes.find(attr => attr.ID === constants.NUM_STUDENTS_ID)?.Value;
                const qtyStaff = json.Attributes.find(attr => attr.ID === constants.NUM_STAFF_ID)?.Value;
                const qtyPublic = json.Attributes.find(attr => attr.ID === constants.NUM_PUBLIC_ID)?.Value;
                const qtyOthers = json.Attributes.find(attr => attr.ID === constants.NUM_OTHERS_ID)?.Value;
                const quantity = +qtyStudents + +qtyStaff + +qtyPublic + +qtyOthers;
                const techCoordinatorRawString = json.Attributes.find(attr => attr.ID === constants.TECH_COORDINATOR_ID)?.ValueText
                const techCoordinator = techCoordinatorRawString?.substring(techCoordinatorRawString.indexOf("(") + 1, techCoordinatorRawString.indexOf(")"));
                const requestor = json.RequestorName;
                const risk = json.Attributes.find(attr => attr.Name === "DoIT Security Classification")?.ValueText?.charAt(0);
                const summary = json.Attributes.find(attr => attr.Name === "DoIT Security SME Summary")?.ValueText;
                return {
                    date: date,
                    rush: rush,
                    id: id,
                    vendor: vendor,
                    status: status,
                    product: product,
                    description: description,
                    isRenewal: isRenewal,
                    swType: swType,
                    infoClass: infoClass,
                    quantity: quantity,
                    techCoordinator: techCoordinator,
                    requestor: requestor,
                    risk: risk,
                    summary: summary
                };
            })
            .catch(err => error(err));

        return ticket;
    }

    inject_ticket_ids(filename) {
        const data = fs.readFileSync(filename, 'utf8');
        var lines = data.split('\n');
        if (lines[lines.length-1] == "") {
            lines.pop();
        }
        return lines;
    }

    refresh_tokens() {
        if (typeof this.refreshCallback === "function") this.refreshCallback();
        if ((this.lastRefresh === undefined) || ((Date.now() - this.lastRefresh) / 1000 >= 60)) {
            this.tokens = MAX_TOKENS;
            this.lastRefresh = Date.now();
        }
    }

    consume_token() {
        while (this.tokens < 1) {
            this.refresh_tokens();
            msleep(500);
        }
        this.refresh_tokens();
        this.tokens -= 1;
        return true;
    }

    set_refresh_callback(callback) {
        this.refreshCallback = callback;
    }

}

function error(err) {
    console.error(err);
    process.exit(1);
}

function msleep(n) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, n);
  } 
  
function sleep(n) {
    msleep(n*1000);
}