"use strict";
var bodyParser = require("body-parser");
var express = require("express");
var fs = require("fs");
var moment = require("moment");
var request = require("request");
var xlsx = require("node-xlsx");
var NaturalGasPrices = (function () {
    function NaturalGasPrices(port) {
        if (port === void 0) { port = 8080; }
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
    NaturalGasPrices.prototype.run = function () {
        var _this = this;
        this.app.listen(this.app.get("port"), function () {
            console.log("Server is running on port " + _this.app.get("port"));
        });
    };
    NaturalGasPrices.formatDate = function (value, timescale) {
        var startDate;
        var startNumber;
        switch (timescale) {
            case "d":
                startDate = moment("01/07/1997", "DD/MM/YYYY");
                startNumber = 35437;
                break;
            case "w":
                startDate = moment("01/10/1997", "DD/MM/YYYY");
                startNumber = 35440;
                break;
            case "m":
                startDate = moment("01/1997", "MM/YYYY");
                startNumber = 35445;
                break;
            case "a":
                startDate = moment("1997", "YYYY");
                startNumber = 35611;
                break;
        }
        var JULY_01_1997_NUMBER = 35437;
        return startDate.add((value - JULY_01_1997_NUMBER), "days").format("DD/MM/YYYY");
    };
    NaturalGasPrices.prototype.downloadData = function (req, res) {
        var timescale = req.params.timescale || "d";
        if (["d", "w", "m", "a"].indexOf(timescale) === -1)
            res.status(400).send({
                status: 400,
                error: "Timescale must be one of the following - d, w, m or a"
            });
        return request("http://www.eia.gov/dnav/ng/hist_xls/RNGWHHD" + timescale + ".xls")
            .pipe(fs.createWriteStream("temp.xls"))
            .on("error", function (err) {
            res.status(500).send({
                status: 500,
                error: err
            });
        })
            .on("close", function (err, message) {
            if (err)
                throw err;
            var worksheets = xlsx.parse("temp.xls");
            fs.unlinkSync("temp.xls");
            var data = worksheets[1].data;
            var csv = data
                .map(function (d, i) {
                if (i === 0 || i === 1 || i === 2)
                    return;
                if (typeof d[1] === "undefined")
                    return;
                return NaturalGasPrices.formatDate(d[0], timescale) + "," + d[1];
            })
                .filter(function (d) {
                if (d !== null || typeof d !== "null")
                    return d;
            });
            res.send({
                status: 200,
                data: csv
            });
        });
    };
    return NaturalGasPrices;
}());
// Application Starting Point
var app = new NaturalGasPrices().run();
