const express = require('express');
const mysql = require('mysql2');
const app = express();

app.use(express.json());

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'customer'
});

app.get('/api/customer', (req, res) => {
    const { nimi, osoite, asty } = req.query;

    let sql = `
        SELECT 
            a.AVAIN,
            a.NIMI,
            a.OSOITE,
            a.POSTINRO,
            a.POSTITMP,
            a.LUONTIPVM,
            a.ASTY_AVAIN,
            at.SELITE as ASTY_SELITE
        FROM asiakas a
        LEFT JOIN asiakastyyppi at ON a.ASTY_AVAIN = at.AVAIN
        WHERE 1=1
    `;

    if (nimi) sql += ` AND a.NIMI LIKE '${nimi}%'`;
    if (osoite) sql += ` AND a.OSOITE LIKE '${osoite}%'`;
    if (asty) sql += ` AND a.ASTY_AVAIN = '${asty}'`;

    //console.log('Executing SQL:', sql); // Debugging log

    connection.query(sql, (error, results) => {
        if (error) {
            //console.error('Query Error:', error); // Debugging log    
        res.status(200).json({
                status: "NOT OK",
                message: "Virheellinen haku",
                data: []
            });
            return;
        }

        //console.log('Query Results:', results); // Debugging log

        res.status(200).json({
            status: results.length > 0 ? "OK" : "NOT OK",
            message: results.length > 0 ? "" : "Virheellinen haku",
            data: results
        });
    });
});

app.use((req, res) => {
    connection.query('SELECT COUNT(*) as count FROM asiakas', (error, results) => {
        if (error) {
            res.status(404).json({
                message: `Osoite oli virheellinen:${req.originalUrl}`,
                count: 0
            });
            return;
        }

        res.status(404).json({
            message: `Osoite oli virheellinen:${req.originalUrl}`,
            count: results[0].count
        });
    });
});

module.exports = app;