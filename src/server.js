/**
 * React Starter Kit (https://www.reactstarterkit.com/)
 *
 * Copyright © 2014-2016 Kriasoft, LLC. All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import 'babel-core/polyfill';
import path from 'path';
import express from 'express';
import React from 'react';
import ReactDOM from 'react-dom/server';
import Router from './routes';
import Html from './components/Html';
import assets from './assets';
import { port } from './config';
import Config from './config.json';
import db from 'sqlite';

const hue = require('node-hue-api');
const server = global.server = express();

async function getBridge(id) {
  if (typeof id === 'undefined') {
    return await db.get('SELECT * FROM bridges ' +
                        'ORDER BY id DESC LIMIT 1');
  }
  return await db.get('SELECT * FROM bridges WHERE id = ?', id);
}

async function getHueApi(id) {
  const connection = await getBridge(id);
  return new hue.HueApi(connection.ip, connection.user);
}

function sendBridgeDetails(connection, res) {
  const api = new hue.HueApi(connection.ip, connection.user);
  api.config().then((bridge) => {
    res.json({ connection, bridge });
  }).fail((err) => {
    res.status(400).json({ error: err, connection });
  }).done();
}

function setLightState(api, id, state, res) {
  api.setLightState(id, state).then((result) => {
    res.json(result);
  }).fail((err) => {
    res.status(400).json(err);
  }).done();
}

async function saveBridge(ip, user) {
  let bridge = await db.get('SELECT * FROM bridges ' +
                            'WHERE ip = ? AND user = ?', ip, user);
  if (typeof bridge === 'object') {
    await db.run('UPDATE bridges SET user = ? WHERE ip = ?', user, ip);
    bridge = await getBridge(bridge.id);
  } else {
    await db.run('INSERT INTO bridges (user, ip) VALUES (?, ?)', user, ip);
    bridge = await getBridge();
  }
  return bridge;
}

//
// Register Node.js middleware
// -----------------------------------------------------------------------------
server.use(express.static(path.join(__dirname, 'public')));

//
// Register API middleware
// -----------------------------------------------------------------------------
server.use('/api/content', require('./api/content'));

server.all('*', (req, res, next) => {
  res.header('Access-Control-Allow-Origin',
             Config[process.env.NODE_ENV].clientUri);
  res.header('Access-Control-Allow-Headers', 'X-Requested-With');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

server.get('/bridge', async (req, res) => {
  const result = await db.get('SELECT COUNT(*) AS count FROM bridges');
  if (result.count < 1) {
    res.status(400).json({ error: 'There are no bridges.' });
    return;
  }
  const connection = await getBridge();
  sendBridgeDetails(connection, res);
});

server.get('/bridges/discover', async (req, res) => {
  const timeout = 2000; // 2 seconds
  hue.nupnpSearch(timeout).then((bridges) => {
    res.json(bridges);
  }).fail((err) => {
    res.status(400).json(err);
  }).done();
});

server.get('/bridges/:id', async (req, res) => {
  const connection = await getBridge(req.params.id);
  sendBridgeDetails(connection, res);
});

server.post('/bridges', async (req, res) => {
  const ip = req.query.ip;
  if (typeof ip !== 'string' || ip.length < 1) {
    res.status(400).
        json({ error: 'Must provide Hue Bridge IP address in ip param' });
    return;
  }
  const user = req.query.user;
  if (typeof user !== 'string' || user.length < 1) {
    res.status(400).
        json({ error: 'Must provide Hue Bridge user in user param' });
    return;
  }
  const bridge = await saveBridge(ip, user);
  sendBridgeDetails(bridge, res);
});

server.post('/users', async (req, res) => {
  const ip = req.query.ip;
  if (typeof ip !== 'string' || ip.length < 1) {
    res.status(400).
        json({ error: 'Must provide Hue Bridge IP address in ip param' });
    return;
  }
  const userDescription = req.query.user;
  if (typeof userDescription !== 'string' || userDescription.length < 1) {
    res.status(400).
        json({
          error: 'Must provide Hue Bridge user description in user param',
        });
    return;
  }
  const api = new hue.HueApi();
  api.registerUser(ip, userDescription).then((user) => {
    const bridge = saveBridge(ip, user);
    sendBridgeDetails(bridge, res);
  }).fail((err) => {
    res.status(400).json({ error: err.message });
  }).done();
});

server.get('/group/:id', async (req, res) => {
  const api = await getHueApi(req.query.connectionID);
  api.getGroup(req.params.id).then((group) => {
    res.json(group);
  }).fail((err) => {
    res.status(400).json(err);
  }).done();
});

server.get('/light/:id', async (req, res) => {
  const api = await getHueApi(req.query.connectionID);
  api.lightStatus(req.params.id).then((result) => {
    res.json(result);
  }).fail((err) => {
    res.status(400).json(err);
  }).done();
});

server.post('/light/:id/on', async (req, res) => {
  const api = await getHueApi(req.query.connectionID);
  const lightState = hue.lightState;
  const state = lightState.create();
  api.setLightState(req.params.id, state.on()).then((result) => {
    res.json(result);
  }).fail((err) => {
    res.status(400).json(err);
  }).done();
});

server.post('/light/:id/off', async (req, res) => {
  const api = await getHueApi(req.query.connectionID);
  const lightState = hue.lightState;
  const state = lightState.create().off();
  setLightState(api, req.params.id, state, res);
});

server.post('/light/:id/color', async (req, res) => {
  const x = req.query.x;
  const y = req.query.y;
  if (typeof x !== 'string') {
    res.status(400).send('{"error": "Must provide x color in x param"}');
    return;
  }
  if (typeof y !== 'string') {
    res.status(400).send('{"error": "Must provide y color in y param"}');
    return;
  }
  const lightState = hue.lightState;
  const api = await getHueApi(req.query.connectionID);
  const state = lightState.create().on().xy(x, y);
  setLightState(api, req.params.id, state, res);
});

//
// Register server-side rendering middleware
// -----------------------------------------------------------------------------
server.get('*', async (req, res, next) => {
  try {
    let statusCode = 200;
    const data = { title: '', description: '', css: '', body: '', entry: assets.main.js };
    const css = [];
    const context = {
      insertCss: styles => css.push(styles._getCss()),
      onSetTitle: value => data.title = value,
      onSetMeta: (key, value) => data[key] = value,
      onPageNotFound: () => statusCode = 404,
    };

    await Router.dispatch({ path: req.path, query: req.query, context }, (state, component) => {
      data.body = ReactDOM.renderToString(component);
      data.css = css.join('');
    });

    const html = ReactDOM.renderToStaticMarkup(<Html {...data} />);
    res.status(statusCode).send('<!doctype html>\n' + html);
  } catch (err) {
    next(err);
  }
});

//
// Launch the server
// -----------------------------------------------------------------------------
const dbName = Config[process.env.NODE_ENV].database || ':memory:';
console.log('Working with database ' + dbName);
db.open(dbName, { verbose: true }).
   then(() => {
     server.listen(port, () => {
       /* eslint-disable no-console */
       console.log(`The server is running at http://localhost:${port}/`);
     });
   }).catch(err => console.error(err));
