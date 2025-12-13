const Category = require('../models/category');
const slugify = require('slugify'); // You might need to install this: npm install slugify

// 1. ADD CATEGORY (Super Admin Only)
exports.addCategory = async (req, res) => {
  try {
    const { name, parentId } = req.body;

    const categoryObj = {
      name,
      slug: slugify(name), // "Brake Pads" -> "brake-pads"
    };

    if (parentId) {
      categoryObj.parent = parentId;
    }

    const cat = new Category(categoryObj);
    await cat.save();
    res.status(201).json({ message: 'Category created', category: cat });

  } catch (err) {
    console.error(err);
    res.status(400).json({ message: 'Error creating category' });
  }
};

// 2. GET ALL CATEGORIES (As a flat list for now)
exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find({});
    res.json(categories);
  } catch (err) {
    res.status(500).send('Server Error');
  }
};