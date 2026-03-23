var express = require("express");
var router = express.Router();
const mysql = require('mysql2');
const session = require('express-session');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const bodyparser = require("body-parser");
const expressLayouts = require('express-ejs-layouts');
router.use(expressLayouts);

router.use('/brand', express.static(path.join(__dirname, 'public/assets/img/brand')));
router.use('/theme', express.static(path.join(__dirname, 'public/assets/img/theme')));
router.use('/IMAGES', express.static(path.join(__dirname, 'public/IMAGES')));
router.use(bodyparser.urlencoded({ extended: true }));
router.use(bodyparser.json());

let email = "";

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

//configuration de la session
router.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-change-me',
    resave: false,
    saveUninitialized: false
}));

//route pour menu
router.get('/table', (_req, res) => {
    res.render('table');
});

//Définir le pool de connections MySQL
const connection = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

connection.getConnection((err, conn) => {
    if (err) {
        console.error("MySQL connection failed:", err.message);
    } else {
        console.log("connected successfully!");
        conn.release();
    }
});

//Route pour extraire les noms d'approbateurs
router.get('/getnames', (_req, res) => {
    const query = 'SELECT fullname FROM users WHERE type="Responsable" ';
    connection.query(query, (error, results) => {
        if (error) {
            console.error('Error fetching names:', error);
            res.status(500).json({ error: 'Error fetching names' });
        } else {
            const names = results.map(result => result.fullname);
            res.json(names);
        }
    });
});

//Fonction pour verfier l'authentification
function ensureAuthenticated(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect("/");
    }
}

//route pour le Login
router.post('/login', (req, res) => {
    email = req.body.email;
    var password = req.body.password;
    connection.query("Select type from users where email = ?", [email], (error, results) => {
        if (error) {
            console.error('Error fetching type:', error);
            res.send('Database error: ' + error.message);
        } else {
            if (results.length === 0) {
                return res.redirect("/");
            }
            const type = results[0].type;

            connection.query("select * from users where email = ? and password = ?", [email, password], function (error, results, _fields) {
                if (error) {
                    console.error('Error during login query:', error);
                    return res.send('Error during login.');
                }
                if (results.length > 0) {
                    if (type === "Secrétaire") {
                        req.session.user = email;
                        res.redirect("./suivre-demande");
                    } else if (type === "Admin") {
                        req.session.user = email;
                        res.redirect("./admin");
                    } else {
                        req.session.user = email;
                        res.redirect("./approuver");
                    }
                } else {
                    res.redirect("/");
                    console.log("Invalid credentials");
                }
            });
        }
    });
});

//route pour le logout
router.get('/', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
        }
        res.redirect('/');
    });
});

//routes pour l'upload des demandes
router.get('/Faire-demande1', ensureAuthenticated, (_req, res) => {
    res.render('Faire-demande1', { layout: 'layout' });
});

router.post('/Faire-demande1', upload.single('file'), (req, res) => {
    if (req.file) {
        connection.query("Select idUsers from users where email = ?", [email], (error, results) => {
            if (error) {
                console.error('Error fetching idUsers:', error);
                res.send('Error fetching idUsers');
            } else {
                const idUser = results[0].idUsers;
                const fileContent = fs.readFileSync(req.file.path);
                const title = req.body.title;
                const comment = req.body.comment;

                connection.query(
                    'INSERT INTO demande (iduser, titre, file_name, file, date_demande, commentaire) VALUES (?, ?, ?, ?, ?, ?)',
                    [idUser, title, req.file.filename, fileContent, new Date(), comment],
                    (error, _result) => {
                        if (error) {
                            console.error('Error saving file to the database:', error);
                            res.send('Error saving file to the database.');
                        } else {
                            const query = 'SELECT LAST_INSERT_ID() as iddemande';
                            connection.query(query, (error, results) => {
                                if (error) {
                                    console.error('Error fetching auto-generated iddemande:', error);
                                } else {
                                    const iddemande = results[0].iddemande;
                                    req.session.autogeneratedIdDemande = iddemande;
                                    res.redirect('./Faire-demande2');
                                }
                            });
                        }
                    }
                );
            }
        });
    } else {
        res.send('No file selected.');
    }
});

//routes pour la sélection des approbateurs à signer
router.get('/Faire-demande2', ensureAuthenticated, (_req, res) => {
    res.render('Faire-demande2', { layout: 'layout' });
});

router.post('/Faire-demande2', (req, res) => {
    const namesString = req.body.selectedNames;
    const selectedNames = namesString.split(',');
    const query = 'INSERT INTO d_a (iddemande, Nomapprobateur, ordre, statut, commentaire) VALUES (?, ?, ?, ?, ?)';

    const insertPromises = selectedNames.map((name, index) => {
        return new Promise((resolve, reject) => {
            connection.query(query, [req.session.autogeneratedIdDemande, name, index + 1, 0, ""], (error) => {
                if (error) {
                    console.error('Error saving selected name:', error);
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    });

    Promise.all(insertPromises)
        .then(() => {
            res.redirect('./suivre-demande');
        })
        .catch((error) => {
            console.error('Error saving selected names:', error);
            res.status(500).json({ error: 'Error saving selected names' });
        });
});

// Route pour affichage des demandes faites et en attente d'approbation
router.get('/suivre-demande', ensureAuthenticated, (_req, res) => {
    const query = 'SELECT iddemande, titre, DATE_FORMAT(date_demande, "%d/%m/%Y" ) AS date_demande, commentaire FROM demande WHERE iduser = (SELECT idUsers FROM users WHERE email = ?) and iddemande in (SELECT iddemande FROM d_a WHERE ordre = 1 and statut = 0 ) order by date_demande';

    connection.query(query, [email], (error, results) => {
        if (error) {
            console.error('Error fetching data from the demande table:', error);
            res.status(500).json({ error: 'Error fetching data' });
        } else {
            results.sort((a, b) => {
                const dateA = new Date(a.date_demande.split('/').reverse().join('/'));
                const dateB = new Date(b.date_demande.split('/').reverse().join('/'));
                return dateB - dateA;
            });
            res.render('suivre', { layout: 'layout', demands: results });
        }
    });
});

// Routes pour visualiser les demandes
router.get('/view-pdf/:id', (req, res) => {
    const fileId = req.params.id;

    connection.query('SELECT file FROM demande WHERE iddemande = ?', fileId, (error, results) => {
        if (error) {
            console.error('Error fetching PDF file:', error);
            res.status(500).json({ error: 'Error fetching PDF file' });
        } else {
            if (results.length > 0) {
                const fileData = results[0].file;
                res.contentType('application/pdf');
                res.send(fileData);
            } else {
                res.status(404).json({ error: 'File not found' });
            }
        }
    });
});

// Routes pour afficher les demandes à approuver par l'approbateur
router.get('/approuver', ensureAuthenticated, async (_req, res) => {
    try {
        const query2 = 'SELECT iddemande, ordre, statut FROM d_a WHERE Nomapprobateur = (SELECT fullname FROM users WHERE email = ?) and iddemande in (SELECT iddemande FROM(SELECT iddemande FROM demande AS tableau WHERE iddemande IN (SELECT iddemande FROM d_a WHERE Nomapprobateur = (SELECT fullname FROM users WHERE email = ?)) order by date_demande) AS id1)';
        const query4 = 'SELECT iddemande, titre, DATE_FORMAT(date_demande, "%d/%m/%Y" ) as date_demande FROM demande WHERE iddemande IN (SELECT iddemande FROM d_a WHERE statut = 0 and Nomapprobateur = (SELECT fullname FROM users WHERE email = ?) and ordre=?) order by date_demande';
        const query5 = 'SELECT statut FROM d_a WHERE iddemande=? and ordre=?';
        const query6 = 'SELECT iddemande, titre, DATE_FORMAT(date_demande, "%d/%m/%Y" ) as date_demande FROM demande WHERE iddemande = ?';

        const results1 = await queryDatabase(query2, [email, email]);
        const Listordre = results1.map(obj => Object.values(obj));

        const results2 = await queryDatabase(query4, [email, 1]);
        let result = results2.slice();

        for (const x of Listordre) {
            if (x[1] > 1 && x[2] === 0) {
                const results3 = await queryDatabase(query5, [x[0], x[1] - 1]);
                if (results3.length > 0 && results3[0].statut === 1) {
                    const results4 = await queryDatabase(query6, [x[0]]);
                    result = result.concat(results4);
                }
            }
        }

        result.sort((a, b) => {
            const dateA = new Date(a.date_demande.split('/').reverse().join('/'));
            const dateB = new Date(b.date_demande.split('/').reverse().join('/'));
            return dateB - dateA;
        });

        res.render('approuver', { layout: 'layout2', demands: result });
    } catch (error) {
        console.error('Error in /approuver route:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// fonction qui va faciliter l'accés à la base des données
function queryDatabase(query, values) {
    return new Promise((resolve, reject) => {
        connection.query(query, values, (error, results) => {
            if (error) {
                reject(error);
            } else {
                resolve(results);
            }
        });
    });
}

// Route pour le boutton approuver
router.get('/approuver-demande/:id', ensureAuthenticated, (req, res) => {
    const iddemande = req.params.id;
    const updateQuery = 'UPDATE d_a SET statut = 1 WHERE iddemande = ? AND Nomapprobateur = (SELECT fullname FROM users WHERE email = ?)';

    connection.query(updateQuery, [iddemande, email], (error, _results) => {
        if (error) {
            console.error('Error updating statut:', error);
            res.status(500).json({ error: 'Error updating statut' });
        } else {
            res.sendStatus(200);
        }
    });
});

// Route pour extraire l'ordre d'approbateur pour une demande donnée
router.get('/get-order/:iddemande', ensureAuthenticated, async (req, res) => {
    const { iddemande } = req.params;
    const query = 'SELECT ordre FROM d_a WHERE iddemande = ? AND Nomapprobateur = (SELECT fullname FROM users WHERE email = ?)';

    try {
        const results = await queryDatabase(query, [iddemande, email]);
        if (results.length > 0) {
            const order = results[0].ordre;
            res.json({ order });
        } else {
            res.status(404).json({ error: 'Order not found for the current user and demand.' });
        }
    } catch (error) {
        console.error('Error in /get-order route:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Route pour approuver après refus
router.get('/approuver-demande-refused/:iddemande', ensureAuthenticated, async (req, res) => {
    const { iddemande } = req.params;
    const { order } = req.query;
    const updateQuery = 'UPDATE d_a SET statut = 0 WHERE iddemande = ? AND ordre = ?';

    try {
        await queryDatabase(updateQuery, [iddemande, parseInt(order) + 1]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error in /approuver-demande route:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Route pour le boutton refuser
router.get('/refuser-demande/:id', ensureAuthenticated, (req, res) => {
    const iddemande = req.params.id;
    const comment = req.query.comment;
    const updateQuery = 'UPDATE d_a SET statut = 2, commentaire = ? WHERE iddemande = ? AND Nomapprobateur = (SELECT fullname FROM users WHERE email = ?)';

    connection.query(updateQuery, [comment, iddemande, email], (error, _results) => {
        if (error) {
            console.error('Error updating statut and commentaire:', error);
            res.status(500).json({ error: 'Error updating statut and commentaire' });
        } else {
            res.sendStatus(200);
        }
    });
});

// Route pour afficher les demandes refusées pour le demandeur
router.get('/demandes-refusees', (_req, res) => {
    const query = 'SELECT iddemande, titre, DATE_FORMAT(date_demande, "%d/%m/%Y" ) AS date_demande FROM demande WHERE iduser = (SELECT idUsers FROM users WHERE email = ?) and iddemande in (SELECT iddemande FROM d_a WHERE ordre = 1 and statut =2) order by date_demande';
    const query1 = 'SELECT iddemande, commentaire from d_a WHERE ordre = 1 AND statut=2 AND iddemande in (SELECT iddemande FROM demande WHERE iduser = (SELECT idUsers FROM users WHERE email = ?)) ';

    connection.query(query, [email], (error, results) => {
        if (error) {
            console.error('Error fetching data from the demande table:', error);
            res.status(500).json({ error: 'Error fetching data' });
        } else {
            const demands = results;
            connection.query(query1, [email], (error, results1) => {
                if (error) {
                    console.error('Error fetching data from the d_a table:', error);
                    res.status(500).json({ error: 'Error fetching data' });
                } else {
                    const mergedResults = demands.map(demand => {
                        const matchingResult = results1.find(result => result.iddemande === demand.iddemande);
                        return { ...demand, ...matchingResult };
                    });
                    res.render('refused', { layout: 'layout', demands: mergedResults });
                }
            });
        }
    });
});

// Route pour la suppression des demandes
router.delete('/delete-demand/:id', (req, res) => {
    const demandId = req.params.id;

    connection.beginTransaction(function (err) {
        if (err) {
            console.error('Error starting transaction:', err);
            res.status(500).json({ success: false, error: 'Error starting transaction' });
            return;
        }

        const deleteDemandeQuery = 'DELETE FROM demande WHERE iddemande = ?';
        connection.query(deleteDemandeQuery, [demandId], function (error1, _results1) {
            if (error1) {
                console.error('Error deleting from demande table:', error1);
                connection.rollback(function () {
                    res.status(500).json({ success: false, error: 'Error deleting from demande table' });
                });
                return;
            }

            const deleteDaQuery = 'DELETE FROM d_a WHERE iddemande = ?';
            connection.query(deleteDaQuery, [demandId], function (error2, _results2) {
                if (error2) {
                    console.error('Error deleting from d_a table:', error2);
                    connection.rollback(function () {
                        res.status(500).json({ success: false, error: 'Error deleting from d_a table' });
                    });
                    return;
                }

                connection.commit(function (err) {
                    if (err) {
                        console.error('Error committing transaction:', err);
                        connection.rollback(function () {
                            res.status(500).json({ success: false, error: 'Error committing transaction' });
                        });
                    } else {
                        res.json({ success: true });
                    }
                });
            });
        });
    });
});

// Route pour afficher les demandes approuvées pour le demandeur
router.get('/demandes-approuvees', (_req, res) => {
    const query = 'SELECT d.iddemande, d.titre, DATE_FORMAT(d.date_demande, "%d/%m/%Y") AS date_demande FROM demande d WHERE d.iduser = (SELECT u.idUsers FROM users u WHERE u.email = ?) AND d.iddemande IN (SELECT da.iddemande FROM (SELECT iddemande, statut, ordre FROM d_a WHERE statut = 1 AND ordre IN (SELECT MAX(ordre) as ordre FROM d_a GROUP BY iddemande) AND ordre = 1 AND statut = 1) da) ORDER BY date_demande';

    connection.query(query, [email], (error, results) => {
        if (error) {
            console.error('Error fetching data from the demande table:', error);
            res.status(500).json({ error: 'Error fetching data' });
        } else {
            results.sort((a, b) => {
                const dateA = new Date(a.date_demande.split('/').reverse().join('/'));
                const dateB = new Date(b.date_demande.split('/').reverse().join('/'));
                return dateB - dateA;
            });
            res.render('telecharger', { layout: 'layout', demands: results });
        }
    });
});

// Route dédié pour l'approbateur pour afficher les demandes approuvées par lui meme
router.get('/app-demandes-approuvees', ensureAuthenticated, (_req, res) => {
    const query = 'SELECT iddemande, titre, DATE_FORMAT(date_demande, "%d/%m/%Y" ) AS date_demande, commentaire FROM demande WHERE iddemande in (SELECT iddemande FROM d_a WHERE Nomapprobateur = (SELECT fullname From users where email = ? ) AND statut = 1 ) order by date_demande';

    connection.query(query, [email, email], (error, results) => {
        if (error) {
            console.error('Error fetching data from the demande table:', error);
            res.status(500).json({ error: 'Error fetching data' });
        } else {
            results.sort((a, b) => {
                const dateA = new Date(a.date_demande.split('/').reverse().join('/'));
                const dateB = new Date(b.date_demande.split('/').reverse().join('/'));
                return dateB - dateA;
            });
            res.render('approuved', { layout: 'layout2', demands: results });
        }
    });
});

// Route dédié pour l'approbateur pour afficher les demandes approuvées par celui qui le précède après qu'il l'a refusé
router.get('/app-demandes-refusees', ensureAuthenticated, async (_req, res) => {
    try {
        const query1 = 'SELECT iddemande, ordre FROM d_a WHERE statut = 1 AND Nomapprobateur = (SELECT fullname FROM users WHERE email = ?)';
        const query3 = 'SELECT iddemande, statut, commentaire FROM d_a WHERE iddemande=? and ordre=?';
        const query7 = 'SELECT iddemande, titre, DATE_FORMAT(date_demande, "%d/%m/%Y" ) as date_demande FROM demande';

        const results1 = await queryDatabase(query1, [email]);
        const Listordre = results1.map(obj => Object.values(obj));

        let result = [];

        for (const x of Listordre) {
            const results2 = await queryDatabase(query3, [x[0], x[1] + 1]);
            if (results2.length > 0) {
                const statut = results2[0].statut;
                if (statut === 2) {
                    result = result.concat(results2);
                }
            }
        }

        const results3 = await queryDatabase(query7);

        if (result.length === 0) {
            res.render('refused-app', { layout: 'layout2', demands: [] });
        } else {
            const combinedData = result.map(entry => {
                const matchingResult = results3.find(r => r.iddemande === entry.iddemande);
                if (matchingResult) {
                    return {
                        iddemande: entry.iddemande,
                        statut: entry.statut,
                        commentaire: entry.commentaire,
                        titre: matchingResult.titre,
                        date_demande: matchingResult.date_demande,
                    };
                } else {
                    return {
                        iddemande: entry.iddemande,
                        statut: entry.statut,
                        commentaire: entry.commentaire,
                        titre: '',
                        date_demande: '',
                    };
                }
            });
            combinedData.sort((a, b) => {
                const dateA = new Date(a.date_demande.split('/').reverse().join('/'));
                const dateB = new Date(b.date_demande.split('/').reverse().join('/'));
                return dateB - dateA;
            });
            res.render('refused-app', { layout: 'layout2', demands: combinedData });
        }
    } catch (error) {
        console.error('Error in /app-demandes-refusees route:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Routes pour changer mot de passe
router.get('/change-password', ensureAuthenticated, (_req, res) => {
    res.render('password', { layout: 'layout' });
});

router.post('/change-password', ensureAuthenticated, (req, res) => {
    const { 'current-password': currentPassword, 'new-password': newPassword, 'confirm-password': confirmPassword } = req.body;
    const email = req.session.user;
    const query = 'SELECT password FROM users WHERE email = ?';

    connection.query(query, [email], (error, results) => {
        if (error) {
            console.error('Error fetching current password:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const storedPassword = results[0].password;
        if (storedPassword !== currentPassword) {
            return res.status(401).json({ error: 'Current password is incorrect.' });
        }
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ error: 'New password and confirmation do not match.' });
        }

        const updateQuery = 'UPDATE users SET password = ? WHERE email = ?';
        connection.query(updateQuery, [newPassword, email], (updateError) => {
            if (updateError) {
                console.error('Error updating password:', updateError);
                return res.status(500).json({ error: 'Internal Server Error' });
            }
            const successMessage = 'Password successfully changed.';
            res.render('password', { layout: 'layout', message: successMessage });
        });
    });
});

router.get('/change-password2', ensureAuthenticated, (_req, res) => {
    res.render('password', { layout: 'layout2' });
});

router.post('/change-password2', ensureAuthenticated, (req, res) => {
    const { 'current-password': currentPassword, 'new-password': newPassword, 'confirm-password': confirmPassword } = req.body;
    const email = req.session.user;
    const query = 'SELECT password FROM users WHERE email = ?';

    connection.query(query, [email], (error, results) => {
        if (error) {
            console.error('Error fetching current password:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const storedPassword = results[0].password;
        if (storedPassword !== currentPassword) {
            return res.status(401).json({ error: 'Current password is incorrect.' });
        }
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ error: 'New password and confirmation do not match.' });
        }

        const updateQuery = 'UPDATE users SET password = ? WHERE email = ?';
        connection.query(updateQuery, [newPassword, email], (updateError) => {
            if (updateError) {
                console.error('Error updating password:', updateError);
                return res.status(500).json({ error: 'Internal Server Error' });
            }
            const successMessage = 'Password successfully changed.';
            res.render('password', { layout: 'layout2', message: successMessage });
        });
    });
});

router.get('/reset-password', (_req, res) => {
    res.render('reset', { layout: 'layout4' });
});

// routes d'admin
router.get('/admin', ensureAuthenticated, (_req, res) => {
    const query = 'SELECT idUsers,fullname, poste, email, password,type,idsecretaire FROM users';
    connection.query(query, (error, results) => {
        if (error) {
            console.error('Error fetching user data:', error);
            res.status(500).json({ error: 'Error fetching user data' });
        } else {
            res.render('admin', { layout: 'layout3', users: results });
        }
    });
});

// ajouter un utilisateur
router.post('/admin', (req, res) => {
    const { fullname, poste, email, password, idsecretaire, type } = req.body;
    const insertQuery = 'INSERT INTO users (fullname, poste, email, password, idsecretaire, type) VALUES (?, ?, ?, ?, ?, ?)';
    const values = [fullname, poste, email, password, idsecretaire, type];

    connection.query(insertQuery, values, (error, _results) => {
        if (error) {
            console.error('Error registering user:', error);
            res.status(500).send('Error registering user.');
        } else {
            console.log('User registered successfully');
            res.redirect('./admin');
        }
    });
});

// supprimer un utilisateur
router.delete('/admin/delete/:userId', ensureAuthenticated, (req, res) => {
    const userId = req.params.userId;
    const deleteQuery = 'DELETE FROM users WHERE idUsers = ?';

    connection.query(deleteQuery, [userId], (error, _results) => {
        if (error) {
            console.error('Error deleting user:', error);
            res.json({ success: false });
        } else {
            console.log('User deleted successfully');
            res.json({ success: true });
        }
    });
});

// Route dédié au secrétaire pour consulter la boite de réception de son responsable
router.get('/messagerie-responsable', ensureAuthenticated, async (_req, res) => {
    try {
        const query  = 'SELECT email FROM users WHERE idUsers = (SELECT idsecretaire FROM users WHERE email=?)';
        const query2 = 'SELECT iddemande, ordre, statut FROM d_a WHERE Nomapprobateur = (SELECT fullname FROM users WHERE email = ?) and iddemande in (SELECT iddemande FROM(SELECT iddemande FROM demande AS tableau WHERE iddemande IN (SELECT iddemande FROM d_a WHERE Nomapprobateur = (SELECT fullname FROM users WHERE email = ?)) order by date_demande) AS id1)';
        const query4 = 'SELECT iddemande, titre, DATE_FORMAT(date_demande, "%d/%m/%Y" ) as date_demande FROM demande WHERE iddemande IN (SELECT iddemande FROM d_a WHERE statut = 0 and Nomapprobateur = (SELECT fullname FROM users WHERE email = ?) and ordre=?) order by date_demande';
        const query5 = 'SELECT statut FROM d_a WHERE iddemande=? and ordre=?';
        const query6 = 'SELECT iddemande, titre, DATE_FORMAT(date_demande, "%d/%m/%Y" ) as date_demande FROM demande WHERE iddemande = ?';

        const resu = await queryDatabase(query, [email]);
        const email2 = resu[0].email;

        const results1 = await queryDatabase(query2, [email2, email2]);
        const Listordre = results1.map(obj => Object.values(obj));

        const results2 = await queryDatabase(query4, [email2, 1]);
        let result = results2.slice();

        for (const x of Listordre) {
            if (x[1] > 1 && x[2] === 0) {
                const results3 = await queryDatabase(query5, [x[0], x[1] - 1]);
                const statut = results3[0].statut;
                if (statut === 1) {
                    const results4 = await queryDatabase(query6, [x[0]]);
                    result = result.concat(results4);
                }
            }
        }

        result.sort((a, b) => {
            const dateA = new Date(a.date_demande.split('/').reverse().join('/'));
            const dateB = new Date(b.date_demande.split('/').reverse().join('/'));
            return dateB - dateA;
        });

        res.render('annexe', { layout: 'layout', demands: result });
    } catch (error) {
        console.error('Error in /messagerie-approbateur route:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Route dédié au secrétaire pour consulter les demandes refusées par l'approbateur qui suit son responsable
router.get('/messagerie-responsable-B', ensureAuthenticated, async (_req, res) => {
    try {
        const query  = 'SELECT email FROM users WHERE idUsers = (SELECT idsecretaire FROM users WHERE email=?)';
        const query1 = 'SELECT iddemande, ordre FROM d_a WHERE statut = 1 AND Nomapprobateur = (SELECT fullname FROM users WHERE email = ?)';
        const query3 = 'SELECT iddemande, statut, commentaire FROM d_a WHERE iddemande=? and ordre=?';
        const query7 = 'SELECT iddemande, titre, DATE_FORMAT(date_demande, "%d/%m/%Y" ) as date_demande FROM demande';

        const resu = await queryDatabase(query, [email]);
        const email3 = resu[0].email;
        const results1 = await queryDatabase(query1, [email3]);
        const Listordre = results1.map(obj => Object.values(obj));

        let result = [];

        for (const x of Listordre) {
            const results2 = await queryDatabase(query3, [x[0], x[1] + 1]);
            if (results2.length > 0) {
                const statut = results2[0].statut;
                if (statut === 2) {
                    result = result.concat(results2);
                }
            }
        }

        const results3 = await queryDatabase(query7);

        if (result.length === 0) {
            res.render('refused-app', { layout: 'layout', demands: [] });
        } else {
            const combinedData = result.map(entry => {
                const matchingResult = results3.find(r => r.iddemande === entry.iddemande);
                if (matchingResult) {
                    return {
                        iddemande: entry.iddemande,
                        statut: entry.statut,
                        commentaire: entry.commentaire,
                        titre: matchingResult.titre,
                        date_demande: matchingResult.date_demande,
                    };
                } else {
                    return {
                        iddemande: entry.iddemande,
                        statut: entry.statut,
                        commentaire: entry.commentaire,
                        titre: '',
                        date_demande: '',
                    };
                }
            });
            combinedData.sort((a, b) => {
                const dateA = new Date(a.date_demande.split('/').reverse().join('/'));
                const dateB = new Date(b.date_demande.split('/').reverse().join('/'));
                return dateB - dateA;
            });
            res.render('annexe2', { layout: 'layout', demands: combinedData });
        }
    } catch (error) {
        console.error('Error in /messagerie-responsable-B route:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
