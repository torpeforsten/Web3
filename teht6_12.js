// Import necessary modules
const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');

const app = express();
const port = 3004;

// Middleware
app.use(bodyParser.json());

// MySQL connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'customer'
});

db.connect((err) => {
    if (err) throw err;
    console.log('Connected to database');
});

// Utility functions
const validateFields = (fields, requiredFields) => {
    const missingFields = requiredFields.filter((field) => !fields[field] || fields[field].toString().trim() === '');
    return missingFields.length > 0 ? `Pakollisia tietoja puuttuu:${missingFields.join(',')}` : null;
};

// Add a new customer (Task 6 & 7)
app.post('/api/customer', (req, res) => {
    console.log('Received request body:', req.body); // Log the incoming data

    const { nimi, osoite, postinro, postitmp, asty_avain } = req.body;
    const requiredFields = ['nimi', 'osoite', 'postinro', 'postitmp', 'asty_avain'];

    const validationError = validateFields(req.body, requiredFields);
    if (validationError) {
        return res.status(400).json({ status: 'NOT OK', message: validationError });
    }

    const sql = `
    INSERT INTO asiakas (nimi, osoite, postinro, postitmp, asty_avain, muutospvm, LUONTIPVM)
    VALUES (?, ?, ?, ?, ?, NOW(), NOW())
`;
const values = [nimi, osoite, postinro, postitmp, asty_avain];


    db.query(sql, values, (err, result) => {
        if (err) {
            console.error('Error during database query:', err); // Log the error
            return res.status(400).json({ status: 'NOT OK', message: err.message });
        }
        res.status(201).json({ avain: result.insertId, nimi, osoite, postinro, postitmp, asty_avain });
    });
});




// Delete a customer (Task 8 & 9)
app.delete('/api/customer/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);

    const sql = 'DELETE FROM asiakas WHERE avain = ?';
    db.query(sql, [id], (err, result) => {
        if (err) {
            return res.status(400).json({ status: 'NOT OK', message: err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ status: 'NOT OK', message: `Poistettavaa asiakasta ${id} ei löydy` });
        }
        res.status(204).send();
    });
});

// Update customer details (Task 10, 11, and 12)
app.put('/api/customer/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { nimi, osoite, postinro, postitmp, asty_avain, muutospvm } = req.body;
    const requiredFields = ['nimi', 'osoite', 'postinro', 'postitmp', 'asty_avain'];

    const validationError = validateFields(req.body, requiredFields);
    if (validationError) {
        return res.status(400).json({ status: 'NOT OK', message: validationError });
    }

    if (isNaN(id) || id <= 0) {
        return res.status(400).json({ status: 'NOT OK', message: 'Pakollisia tietoja puuttuu:nimi,osoite,postinro,postitmp,asty_avain,avain' });
    }

    // First, check if the customer exists
    const checkCustomerSql = 'SELECT * FROM asiakas WHERE avain = ?';
    db.query(checkCustomerSql, [id], (err, result) => {
        if (err) {
            return res.status(400).json({ status: 'NOT OK', message: err.message });
        }
        if (result.length === 0) {
            return res.status(404).json({ status: 'NOT OK', message: 'Asiakasta ei löydy' });
        }

        const dbCustomer = result[0];

        // Check if the customer data has changed in the database (versioning)
        if (dbCustomer.muutospvm !== muutospvm) {
            return res.status(400).json({
                status: 'NOT OK',
                message: 'Tietoja ei voi päivittää, tiedot vanhentuneet'
            });
        }

        // If no conflict, update the customer details
        const updateSql = `UPDATE asiakas SET nimi = ?, osoite = ?, postinro = ?, postitmp = ?, asty_avain = ?, muutospvm = NOW() WHERE avain = ?`;
        const updateValues = [nimi, osoite, postinro, postitmp, asty_avain, id];

        db.query(updateSql, updateValues, (err, updateResult) => {
            if (err) {
                return res.status(400).json({ status: 'NOT OK', message: err.message });
            }
            if (updateResult.affectedRows === 0) {
                return res.status(400).json({ status: 'NOT OK', message: 'Tietoja ei voi päivittää, tiedot vanhentuneet' });
            }
            res.status(204).send();  // No content
        });
    });
});

module.exports = app;
