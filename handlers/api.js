const { handleNext, jsonMessage } = require("../functions");
const db = require("../db");
const Request = require("request");
const Moment = require("moment");

exports.evaluateEntry = (request, response) => {
    if (request.decodedToken) {
        if (!request.body) {
            return handleNext(next, 400, "No request body received");
        }
        try {
            const { entry_id, creativity, complexity, quality_code, interpretation, skill_level } = request.body;
            const values = [entry_id, request.decodedToken.evaluator_id, (creativity / 2), (complexity / 2), (quality_code / 2), (interpretation / 2), skill_level]
            return db.query("SELECT evaluate($1, $2, $3, $4, $5, $6, $7)", values, res => {
                if (res.error) {
                    return handleNext(next, 400, "There was a problem evaluating this entry");
                }
                return response.redirect("/judging");
            });
        } catch(err) {
            return handleNext(next, 400, "There was a problem evaluating this entry");
        }
    }
    handleNext(next, 401, "Unauthorized");
}

// WIP, could be used to load all entries into DB once contest deadline is past.
exports.updateEntries = (request, response, next) => {
    if (request.decodedToken) {
        return db.query("SELECT * FROM contest WHERE current = true", [], res => {
            if (res.error) {
                return handleNext(next, 400, "There was a problem getting the current contest");
            }
            let contest_id = res.rows[0].contest_url.split("/")[5];

            return Request(`https://www.khanacademy.org/api/internal/scratchpads/Scratchpad:${contest_id}/top-forks?sort=2&page=0&limit=1000`, (err, res, body) => {
                console.log("Request callback called.");
                if (!JSON.parse(body)) {
                    return handleNext(next, 400, "No request body received");
                } else
                if (err) {
                    return handleNext(next, 400, "There was a problem with the request");
                }

                let data = JSON.parse(body);
                if (data) {
                    console.log("Data exists.");
                    // When data is received (which is sorted already)...
                    // SELECT all current entries in DB table.
                    // Sort current table entries by created date.
                    // Get most recent entry from table, TOP().
                    try {
                        return db.query("SELECT MAX(entry_created) FROM entry", [], res => {
                            if (res.error) {
                                return handleNext(next, 400, "There was a problem getting the most recent entry");
                            }
                            console.log("Query callback called.");
                            // Handle error
                            console.log(`${res.rows[0].max} --- ${data.scratchpads.length} new programs.`);
                            for (var i = 0; i < data.scratchpads.length; ++i) {
                                // moment docs: http://momentjs.com/docs/#/query/
                                if (Moment(res.rows[0].max).isBefore(data.scratchpads[i].created)) {
                                    //console.log(`Program ${data.scratchpads[i].title} was created after ${res.rows[0].max} on ${data.scratchpads[i].created}.`);
                                    console.log(`${data.scratchpads[i].created} - ${data.scratchpads[i].url}`)
                                }
                                // console.log(`Program "${data.scratchpads[i].title}" created on ${data.scratchpads[i].created}. ${Moment(res.rows[0].max).isBefore(data.scratchpads[i].created)}`);
                            }
                            return response.send("Done");
                            // Store all API entries created after this returned date.
                            // Loop through entries, and check if each moment(res.row).isBefore(data[i].created)
                        });
                    } catch(err) {
                        return handleNext(next, 400, "There was a problem logging the entry data");
                    }
                    // Now compare most recent table entry creation date to all dates in API entries.
                    // If programs have been created since the most recent in table, store them.
                    // Once all have been compared, INSERT stored entries into table.
                } else {
                    return handleNext(next, 400, "There is no parsed JSON data");
                }
            });
        });
    }
    handleNext(next, 401, "Unauthorized");
}

module.exports = exports;
