import express from 'express';
import { PrismaClient } from '@prisma/client';
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const app = express();
app.use(express.json());

const oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.SECRET_ID,
    process.env.REDIRECT
);

let tokens;

app.get('/', (req, res) => {
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: 'https://www.googleapis.com/auth/calendar'
    });
    res.redirect(url);
});

app.get('/redirect', (req, res) => {
    const code = req.query.code;
    oauth2Client.getToken(code, (err, tkns) => {
        if (err) {
            console.error('Couldn\'t get token', err);
            res.send('Error');
            return;
        }
        oauth2Client.setCredentials(tkns);
        tokens = tkns;
        console.log({tokens})
        res.send('Successfully logged in');
    });
});

app.get('/calendars', (req, res) => {
    if (!tokens) {
        res.send('Not authenticated');
        return;
    }
    oauth2Client.setCredentials(tokens);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    calendar.calendarList.list({}, (err, response) => {
        if (err) {
            console.error('Error fetching calendars', err);
            res.end('Error!');
            return;
        }
        const calendars = response.data.items;
        res.json(calendars);
    });
});

app.get('/events', (req, res) => {
    if (!tokens) {
        res.send('Not authenticated');
        return;
    }
    oauth2Client.setCredentials(tokens);
    const calendarId = req.query.calendar ?? 'primary';
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    calendar.events.list({
        calendarId,
        timeMin: (new Date()).toISOString(),
        maxResults: 15,
        singleEvents: true,
        orderBy: 'startTime'
    }, (err, response) => {
        if (err) {
            console.error('Can\'t fetch events');
            res.send('Error');
            return;
        }
        const events = response.data.items;
        res.json(events);
    });
});

app.post('/create-event', (req, res) => {
    if (!tokens) {
        res.send('Not authenticated');
        return;
    }
    oauth2Client.setCredentials(tokens);
    const calendarId = 'primary';
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const event = {
        summary: req.body.summary,
        description: req.body.description,
        start: {
            dateTime: req.body.startDateTime,
            timeZone: 'America/Sao_Paulo'
        },
        end: {
            dateTime: req.body.endDateTime,
            timeZone: 'America/Sao_Paulo'
        },
        attendees: req.body.attendees,
        conferenceData: {
            createRequest: {
                requestId: Math.random().toString(36).substring(2, 15),
                conferenceSolutionKey: {
                    type: 'hangoutsMeet'
                }
            }
        }
    };
    calendar.events.insert({
        calendarId,
        resource: event,
        conferenceDataVersion: 1
    }, (err, event) => {
        if (err) {
            console.error('Error creating event', err);
            res.send('Error');
            return;
        }
        res.status(201).json(event.data);
    });
});

app.get('/usuarios', async (req, res) => {
    const users = await prisma.user.findMany();
    res.json(users);
});

app.post('/usuarios', async (req, res) => {
    const user = await prisma.user.create({
        data: {
            name: req.body.name,
            email: req.body.email,
            age: req.body.age
        }
    });
    res.status(201).json(user);
});

app.put('/usuarios/:id', async (req, res) => {
    const user = await prisma.user.update({
        where: {
            id: parseInt(req.params.id)
        },
        data: {
            name: req.body.name,
            email: req.body.email,
            age: req.body.age
        }
    });
    res.status(200).json(user);
});

app.delete('/usuarios/:id', async (req, res) => {
    await prisma.user.delete({
        where: {
            id: parseInt(req.params.id)
        }
    });
    res.status(200).json({ message: 'Usuário deletado com sucesso' });
});

app.listen(3000, () => {
    console.log('Servidor rodando na porta 3000');
});
