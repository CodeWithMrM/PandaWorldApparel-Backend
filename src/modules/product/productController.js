const prisma = require("../config/db");

exports.getProducts = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        category: true,
      },
    });

    res.json(products);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};
