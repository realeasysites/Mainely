// 301s from the old mainelyinsulation.com URLs so Google links and bookmarks keep working.
const express = require('express');

const router = express.Router();
const MAP = {
  '/index.html': '/',
  '/about': '/#about',
  '/cellulose': '/services#cellulose',
  '/sprayfoam': '/services#spray-foam',
  '/ventilation': '/services#ventilation',
  '/airsealing': '/services#air-sealing',
  '/fiberglass': '/services#fiberglass',
  '/vapor-barrier': '/services#vapor-barrier',
};

router.get(Object.keys(MAP), (req, res) => {
  const key = req.path.toLowerCase().replace(/\/+$/, '') || '/';
  res.redirect(301, MAP[key] || '/');
});

module.exports = router;
