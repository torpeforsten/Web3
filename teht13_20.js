const express = require('express');
const mysql = require('mysql2');
const app = express();

app.use(express.json());

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'student'
});

// Yhdistäminen tietokantaan
db.connect(err => {
  if (err) {
    console.error("Failed to connect to the database:", err);
    process.exit(1); // Lopetetaan ohjelma virhetilanteessa
  }
  console.log("Connected to the database.");
});

app.post('/api/student', (req, res) => {
  let { etunimi, sukunimi, postinro, typeid, osoiteid, lahiosoite, postitoimipaikka } = req.body;

  try {
    // Tehtävä 13: Osoiteid ja postinro tarkistus
    const missingFields = [];

    if (!etunimi) {
      missingFields.push('etunimi');
    }
    if (!sukunimi) {
      missingFields.push('sukunimi');
    }
    if (!postinro) {
      missingFields.push('postinro');
    }
    if (!typeid || typeid <= 0) {
      missingFields.push('typeid');
    }
    if ((!osoiteid || osoiteid <= 0) && !lahiosoite) {
      missingFields.push('osoiteid');
    }

    if (missingFields.length !== 0) {
      res.statusCode = 400;
      res.json({ statusid: 'NOT OK', message: 'Pakollisia tietoja puuttuu:' + missingFields.join() });
      return;
    }

    // Tehtävä 16: Tarkista typeid status
    const checkTypeSql = "SELECT * FROM studentype WHERE typeid = ? AND Status = 1";
    db.query(checkTypeSql, [typeid], (err, results) => {
      if (err) {
        return res.status(400).json({ statusid: "NOT OK", message: "Database error" });
      }
      if (results.length > 0) {
        return res.status(400).json({
          statusid: "NOT OK",
          message: `Tyyppi ${results[0].selite} ei ole käytössä`
        });
      }

      // Tehtävä 14: Tarkista, ettei saman nimistä opiskelijaa ole jo tietokannassa
      const checkStudentSql = "SELECT * FROM student WHERE etunimi = ? AND sukunimi = ?";
      db.query(checkStudentSql, [etunimi, sukunimi], (err, result) => {
        if (err) {
          console.error("Error checking student:", err);
          return res.status(400).json({ statusid: "NOT OK", message: "Database error" });
        }
        if (result.length > 0) {
          return res.status(400).json({ statusid: "NOT OK", message: `Opiskelija ${etunimi},${sukunimi} on jo olemassa` });
        }

        // Tehtävä 15: Lisää uusi postinumero
        db.query("INSERT ignore INTO postinro (postinumero, postitoimipaikka) VALUES (?, ?)", [postinro, postitoimipaikka], (err, result) => {
          if (err) {
            console.error("Error inserting postinro:", err);
            return res.status(400).json({ statusid: "NOT OK", message: "Database error" });
          }
          console.log("Postinro inserted successfully:", result); // Add logging


          // Tehtävä 15: Lisää uusi opiskelija ja lähiosoite
          if (osoiteid > 0) {

            const insertStudentSql = "INSERT INTO student (etunimi, sukunimi, postinro, typeid, osoite_idosoite) VALUES (?, ?, ?, ?, ?)";
            db.query(insertStudentSql, [etunimi, sukunimi, postinro, typeid, osoiteid], (err, studentResult) => {
              if (err) {
                console.error("Error inserting student:", err);
                return res.status(400).json({ statusid: "NOT OK", message: "Database error" });
              }
              console.log("Student inserted successfully:", studentResult); // Add logging
              return res.status(201).json({ statusid: "OK", message: "Opiskelija lisätty onnistuneesti" });
            });
          }

          // Jos ei ollutkaan hehheh
          else {
            db.query("SELECT * FROM osoite WHERE lahiosoite = ?", [lahiosoite], (err, result) => {
              if (err) {
                console.error("Error checking address:", err);
                return res.status(400).json({ statusid: "NOT OK", message: "Database error" });
              }
              if (result.length > 0) {
                osoiteid = result[0].idosoite;

                // Lisää opiskelija
                const insertStudentSql = "INSERT INTO student (etunimi, sukunimi, postinro, typeid, osoite_idosoite) VALUES (?, ?, ?, ?, ?)";
                db.query(insertStudentSql, [etunimi, sukunimi, postinro, typeid, osoiteid], (err, studentResult) => {
                  if (err) {
                    console.error("Error inserting student:", err);
                    return res.status(400).json({ statusid: "NOT OK", message: "Database error" });
                  }

                  console.log("Student inserted successfully:", studentResult); // Add logging
                  return res.status(201).json({ statusid: "OK", message: "Opiskelija lisätty onnistuneesti" });
                });
              }

              // Lisätään lähiosoitteella jos sitä ei ollut
              else {
                const insertAddressSql = "INSERT INTO osoite (lahiosoite) VALUES (?)";
                db.query(insertAddressSql, [lahiosoite], (err, addressResult) => {
                  if (err) {
                    console.error("Error inserting address:", err);
                    return res.status(400).json({ statusid: "NOT OK", message: "Database error" });
                  }
                  console.log("Address inserted successfully:", addressResult); // Add logging
                  osoiteid = addressResult.insertId;

                  // Lisää opiskelija TAAS
                  const insertStudentSql = "INSERT INTO student (etunimi, sukunimi, postinro, typeid, osoite_idosoite) VALUES (?, ?, ?, ?, ?)";
                  db.query(insertStudentSql, [etunimi, sukunimi, postinro, typeid, osoiteid], (err, studentResult) => {
                    if (err) {
                      console.error("Error inserting student:", err);
                      return res.status(400).json({ statusid: "NOT OK", message: "Database error" });
                    }

                    console.log("Student inserted successfully:", studentResult); // Add logging
                    return res.status(201).json({ statusid: "OK", message: "Opiskelija lisätty onnistuneesti" });
                  });
                });
              }
            });
          }
        });
      });
    });

  } catch (error) {
    console.error("Error in POST /api/student:", error);
    return res.status(400).json({ statusid: "NOT OK", message: "Internal server error" });
  }
});


// tehtävä 17: Opiskelijoiden haku
app.get('/api/student', (req, res) => {
  const { etunimi, sukunimi, typeid } = req.query;

  try {
    let query = `
      SELECT s.id, s.etunimi, s.sukunimi, s.postinro, s.typeid as tyyppi_id, p.postitoimipaikka, o.lahiosoite, st.selite as tyyppi_selite
      FROM student s
      JOIN postinro p ON s.postinro = p.postinumero
      JOIN osoite o ON s.osoite_idosoite = o.idosoite
      JOIN studentype st ON s.typeid = st.typeid
      WHERE 1=1
    `;

    const params = [];
    if (etunimi) {
      query += " AND s.etunimi LIKE ?";
      params.push(etunimi.replace("*", "%"));
    }
    if (sukunimi) {
      query += " AND s.sukunimi LIKE ?";
      params.push(sukunimi.replace("*", "%"));
    }
    if (typeid) {
      query += " AND s.typeid = ?";
      params.push(typeid);
    }

    db.query(query, params, (err, results) => {
      if (err) {
        console.error("Error fetching students:", err);
        return res.status(400).json({ statusid: "NOT OK", message: "Database error" });
      }

      console.log("Students fetched successfully:", results); // Add logging
      return res.status(200).json(results);
    });
  } catch (error) {
    console.error("Error in GET /api/student:", error);
    return res.status(400).json({ statusid: "NOT OK", message: "Internal server error" });
  }
});

// Tehtävä 18: StudentType haku
app.get('/api/studenttype', (req, res) => {
  const all = req.query.all || 0;

  let studentTypeSql = "SELECT * FROM studentype WHERE 1 = 1";
  if (all != 1) {
    studentTypeSql += " AND Status = 0";
  }
  db.query(studentTypeSql, (err, studentTypeResult) => {
    if (err) {
      console.error("Error fetching student types:", err);
      return res.status(400).json({ statusid: "NOT OK", message: "Database error" });
    }
    console.log("Student types fetched successfully:", studentTypeResult);
    for (let item of studentTypeResult) {
      item.status = item.status === 0 ? "KAYTOSSA" : "EI KAYTOSSA";
    }
    return res.status(200).json(studentTypeResult);
  });
});

// Tehtävä 19-20 Hae opiskelija postinumeroittain 
app.get('/api/student/by/postinumero/:postinumero', (req, res) => {
  let postinro = req.params.postinumero;

  let countStudentsSql = "select p.postinumero, count(s.id) as count from postinro p left join student s on p.postinumero = s.postinro where 1=1 ";
  if (postinro != -100) {
    countStudentsSql += `AND p.postinumero = "${postinro}" `;
  }
  countStudentsSql += " GROUP BY p.postinumero order by p.postinumero asc";

  db.query(countStudentsSql, (err, result) => {
    if (err) {
      console.error("Error fetching student count:", err);
      return res.status(400).json({ statusid: "NOT OK", message: "Database error" });
    }
    if (result.length > 0 && result[0].count > 0) {
      return res.status(200).json(result);
    }
    else {
      return res.status(200).json([{ postinumero: postinro, count: 0 }]);
    }
  });
});
module.exports = app;