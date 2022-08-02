# PCRLogger

PCRLogger is a small javascript project to assist the security team at CSULB in managing the ticketing system *TeamDynamix*

## Installation
1. Download and install the latest version of [Node.js](https://nodejs.org/en/download/).
2. Download and install the latest version of [git](https://git-scm.com/downloads).
3. Open a command prompt to check that node and git were installed correctly (you should see three version print out).
```
$ node -v && npm -v && git --version
v16.15.1
8.15.0
git version 2.36.1.windows.1
```
3. Clone PCRLogger from its source.
```
$ git clone https://github.com/bmattlife/pcrlogger.git
``` 
4. Open a command prompt at the root of the project directory and run the following command to install all of the dependencies.
```
$ npm install
```

## Configuration
1. Use the `Get API Key.url` shortcut to obtain an API key.
2. Create a new file named `.env` and paste your API Key into it with the format
```
TDX_KEY=<API_KEY_HERE>
```
> Note: An API Key is only valid for up to 24 hours. You may need to enable hidden files to see the `.env` file.

## Use
1. Create and/or fill `tickets.txt` with 8 digit ticket IDs separated by newlines
```
12345678
24681357
34567654
```
2. Open a command prompt at the root of the project directory and run
```bash
$ npm start
```
3. The output will be saved as `tickets.xlsx`.