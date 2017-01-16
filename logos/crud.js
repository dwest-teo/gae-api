// Copyright 2015-2016, Google, Inc.
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict';

const express = require('express');
const config = require('../config');
const images = require('../lib/images');
const oauth2 = require('../lib/oauth2');

function getModel () {
  return require(`./model-${config.get('DATA_BACKEND')}`);
}

const router = express.Router();

// Use the oauth middleware to automatically get the user's profile
// information and expose login/logout URLs to templates.
router.use(oauth2.template);

// Set Content-Type for all responses for these routes
router.use((req, res, next) => {
  res.set('Content-Type', 'text/html');
  next();
});

/**
 * GET /logos/add
 *
 * Display a page of logos (up to ten at a time).
 */
router.get('/', (req, res, next) => {
  getModel().list(10, req.query.pageToken, (err, entities, cursor) => {
    if (err) {
      next(err);
      return;
    }
    res.render('logos/list.jade', {
      logos: entities,
      nextPageToken: cursor
    });
  });
});

// [START mine]
// Use the oauth2.required middleware to ensure that only logged-in users
// can access this handler.
router.get('/mine', oauth2.required, (req, res, next) => {
  getModel().listBy(
    req.user.id,
    10,
    req.query.pageToken,
    (err, entities, cursor, apiResponse) => {
      if (err) {
        next(err);
        return;
      }
      res.render('logos/list.jade', {
        logos: entities,
        nextPageToken: cursor
      });
    }
  );
});
// [END mine]

/**
 * GET /logos/add
 *
 * Display a form for creating a logo.
 */
router.get('/add', (req, res) => {
  res.render('logos/form.jade', {
    logo: {},
    action: 'Add'
  });
});

/**
 * POST /logos/add
 *
 * Create a logo.
 */
// [START add]
router.post(
  '/add',
  images.multer.single('image'),
  images.sendUploadToGCS,
  (req, res, next) => {
    const data = req.body;

    // If the user is logged in, set them as the creator of the logo.
    if (req.user) {
      data.createdBy = req.user.displayName;
      data.createdById = req.user.id;
    } else {
      data.createdBy = 'Anonymous';
    }

    // Was an image uploaded? If so, we'll use its public URL
    // in cloud storage.
    if (req.file && req.file.cloudStoragePublicUrl) {
      data.imageUrl = req.file.cloudStoragePublicUrl;
    }

    // Save the data to the database.
    getModel().create(data, (err, savedData) => {
      if (err) {
        next(err);
        return;
      }
      res.redirect(`${req.baseUrl}/${savedData.id}`);
    });
  }
);
// [END add]

/**
 * GET /logos/:id/edit
 *
 * Display a logo for editing.
 */
router.get('/:logo/edit', (req, res, next) => {
  getModel().read(req.params.logo, (err, entity) => {
    if (err) {
      next(err);
      return;
    }
    res.render('logos/form.jade', {
      logo: entity,
      action: 'Edit'
    });
  });
});

/**
 * POST /logos/:id/edit
 *
 * Update a logo.
 */
router.post(
  '/:logo/edit',
  images.multer.single('image'),
  images.sendUploadToGCS,
  (req, res, next) => {
    const data = req.body;

    // Was an image uploaded? If so, we'll use its public URL
    // in cloud storage.
    if (req.file && req.file.cloudStoragePublicUrl) {
      req.body.imageUrl = req.file.cloudStoragePublicUrl;
    }

    getModel().update(req.params.logo, data, (err, savedData) => {
      if (err) {
        next(err);
        return;
      }
      res.redirect(`${req.baseUrl}/${savedData.id}`);
    });
  }
);

/**
 * GET /logos/:id
 *
 * Display a logo.
 */
router.get('/:logo', (req, res, next) => {
  getModel().read(req.params.logo, (err, entity) => {
    if (err) {
      next(err);
      return;
    }
    res.render('logos/view.jade', {
      logo: entity
    });
  });
});

/**
 * GET /logos/:id/delete
 *
 * Delete a logo.
 */
router.get('/:logo/delete', (req, res, next) => {
  getModel().delete(req.params.logo, (err) => {
    if (err) {
      next(err);
      return;
    }
    res.redirect(req.baseUrl);
  });
});

/**
 * Errors on "/logos/*" routes.
 */
router.use((err, req, res, next) => {
  // Format error and forward to generic error handler for logging and
  // responding to the request
  err.response = err.message;
  next(err);
});

module.exports = router;
