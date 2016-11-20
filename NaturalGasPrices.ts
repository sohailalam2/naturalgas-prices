import * as bodyParser from "body-parser";
import * as express from "express";
import * as fs from "fs";
import * as moment from "moment";
import * as request from "request";

const xlsx = require("node-xlsx");

class NaturalGasPrices {

    private app: express.Application;

    constructor(port: number = 8080) {
        this.app = express();

        this.app.set("port", (process.env.PORT || port));

        // Process application/x-www-form-urlencoded
        this.app.use(bodyParser.urlencoded({ extended: false }));

        // Process application/json
        this.app.use(bodyParser.json());

        this.app.use(express.static("public"));

        this.app.get("/api/:timescale", this.downloadData);

    }

    // Spin up the server
    public run(): void {
        this.app.listen(this.app.get("port"), () => {
            console.log(`Server is running on port ${this.app.get("port")}`);
        });
    }

    private static formatDate(value: number, timescale: string): string {
        let startDate;
        let startNumber;
        switch (timescale) {
            case "d": startDate = moment("01/07/1997", "DD/MM/YYYY"); startNumber = 35437; break;
            case "w": startDate = moment("01/10/1997", "DD/MM/YYYY"); startNumber = 35440; break;
            case "m": startDate = moment("01/1997", "MM/YYYY"); startNumber = 35445; break;
            case "a": startDate = moment("1997", "YYYY"); startNumber = 35611; break;
        }
        const JULY_01_1997_NUMBER = 35437;
        return startDate.add((value - JULY_01_1997_NUMBER), "days").format("DD/MM/YYYY");
    }

    private downloadData(req: express.Request, res: express.Response) {
        let timescale: string = req.params.timescale || "d";
        if (["d", "w", "m", "a"].indexOf(timescale) === -1)
            res.status(400).send({
                status: 400,
                error: "Timescale must be one of the following - d, w, m or a"
            });

        return request(`http://www.eia.gov/dnav/ng/hist_xls/RNGWHHD${timescale}.xls`)
            .pipe(fs.createWriteStream("temp.xls"))
            .on("error", (err) => {
                res.status(500).send({
                    status: 500,
                    error: err
                });
            })
            .on("close", (err, message) => {
                if (err) throw err;
                const worksheets = xlsx.parse("temp.xls");
                fs.unlinkSync("temp.xls");
                const data = worksheets[1].data;

                const csv: Array<string> = data
                    .map((d, i) => {
                        if (i === 0 || i === 1 || i === 2) return;
                        if (typeof d[1] === "undefined") return;
                        return `${NaturalGasPrices.formatDate(d[0], timescale)},${d[1]}`;
                    })
                    .filter(d => {
                        if (d !== null || typeof d !== "null")
                            return d;
                    });

                res.send({
                    status: 200,
                    data: csv
                });
            });
    }

}

// Application Starting Point
let app = new NaturalGasPrices().run();
