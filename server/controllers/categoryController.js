const Category = require('../models/category');
const slugify = require('slugify');

// Map Mongo doc to API shape (id, parentId) expected by client
function toApiCategory(doc) {
  if (!doc) return null;
  const d = doc.toObject ? doc.toObject() : doc;
  const id = d._id && typeof d._id.toString === 'function' ? d._id.toString() : String(d._id);
  const parentId = d.parent
    ? (typeof d.parent.toString === 'function' ? d.parent.toString() : String(d.parent))
    : null;
  return {
    id,
    name: d.name,
    description: d.description ?? null,
    icon: d.icon ?? null,
    parentId,
  };
}

// 1. ADD CATEGORY (Super Admin Only) – supports parent (subcategory) and top-level
exports.addCategory = async (req, res) => {
  try {
    let { name, parentId, description, icon } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Category name is required' });
    }
    // Coerce empty string to null so subcategory vs top-level is clear
    if (parentId === '') parentId = null;
    if (parentId) {
      const parentExists = await Category.findById(parentId).exec();
      if (!parentExists) {
        return res.status(400).json({ message: 'Parent category not found' });
      }
    }

    const baseSlug = slugify(name.trim(), { lower: true });
    const slug = parentId ? `${baseSlug}-${parentId}` : baseSlug;

    const categoryObj = {
      name: name.trim(),
      slug,
      description: description || null,
      icon: icon || null,
    };
    if (parentId) categoryObj.parent = parentId;

    const cat = new Category(categoryObj);
    await cat.save();
    res.status(201).json(toApiCategory(cat));
  } catch (err) {
    console.error(err);
    if (err.code === 11000) {
      return res.status(400).json({
        message: parentId
          ? 'A subcategory with this name already exists under this parent.'
          : 'A category with this name already exists.',
      });
    }
    res.status(400).json({ message: 'Error creating category' });
  }
};

// 2. GET ALL CATEGORIES
exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find({}).sort({ name: 1 });
    res.json(categories.map(toApiCategory));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// 3. UPDATE CATEGORY (Super Admin Only)
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, parentId, description, icon } = req.body;

    const cat = await Category.findById(id);
    if (!cat) return res.status(404).json({ message: 'Category not found' });

    if (name !== undefined) cat.name = name.trim();
    if (description !== undefined) cat.description = description || null;
    if (icon !== undefined) cat.icon = icon || null;
    if (parentId !== undefined) cat.parent = parentId || null;

    const baseSlug = slugify(cat.name, { lower: true });
    cat.slug = cat.parent ? `${baseSlug}-${cat.parent}` : baseSlug;

    await cat.save();
    res.json(toApiCategory(cat));
  } catch (err) {
    console.error(err);
    if (err.code === 11000) {
      return res.status(400).json({ message: 'A category with this name already exists' });
    }
    res.status(400).json({ message: 'Error updating category' });
  }
};

// 4. DELETE CATEGORY (Super Admin Only) – block if has subcategories
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const subCount = await Category.countDocuments({ parent: id });
    if (subCount > 0) {
      return res.status(400).json({
        message: 'Cannot delete category while it has subcategories. Delete subcategories first.',
      });
    }

    const result = await Category.findByIdAndDelete(id);
    if (!result) return res.status(404).json({ message: 'Category not found' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
};