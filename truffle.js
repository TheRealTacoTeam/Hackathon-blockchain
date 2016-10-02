module.exports = {
  build: {
    "index.html": "index.html",
    "car.html": "car.html",
    "listing.html": "listing.html",
    "report.html": "report.html",

    "app.js": [
      "js/jquery.js",
      "js/bootstrap.min.js",
      "js/app.js"
    ],
    "css/app.css": "css/app.css",
    "css/bootstrap.min.css": "css/bootstrap.min.css",
    "images/": "images/"
  },
  rpc: {
    host: "localhost",
    port: 8545
  }
};
