const router = require("express").Router();

const { getProducts } = require("../modules/product/productController");

router.get("/", getProducts);

module.exports = router;
