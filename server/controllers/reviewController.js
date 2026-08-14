const mongoose = require('mongoose');
const Review = require('../models/review.model');
const Product = require('../models/product');
const User = require('../models/user');

function formatReview(reviewDoc) {
	const review = typeof reviewDoc.toObject === 'function' ? reviewDoc.toObject() : { ...reviewDoc };
	const userDoc = review.user;
	const userId = userDoc && typeof userDoc === 'object'
		? (userDoc._id?.toString?.() || userDoc.id || '')
		: (userDoc?.toString?.() || String(userDoc || ''));

	return {
		id: review._id.toString(),
		productId: review.product.toString(),
		userId,
		rating: review.rating,
		comment: review.comment || '',
		createdAt: review.createdAt,
		updatedAt: review.updatedAt,
		user: userDoc && typeof userDoc === 'object'
			? {
					id: userId,
					fullName: userDoc.name || userDoc.fullName || 'Anonymous',
					avatarUrl: userDoc.avatarUrl,
					email: userDoc.email,
				}
			: undefined,
	};
}

async function updateProductReviewSummary(productId) {
	const [stats] = await Review.aggregate([
		{ $match: { product: new mongoose.Types.ObjectId(productId) } },
		{
			$group: {
				_id: '$product',
				reviewCount: { $sum: 1 },
				averageRating: { $avg: '$rating' },
			},
		},
	]);

	const reviewCount = stats?.reviewCount || 0;
	const averageRating = reviewCount > 0 ? Number(stats.averageRating.toFixed(1)) : 0;

	await Product.findByIdAndUpdate(productId, {
		rating: averageRating,
		reviewCount,
	});

	return { reviewCount, averageRating };
}

async function ensureProductExists(productId) {
	const product = await Product.findById(productId);
	if (!product) {
		const error = new Error('Product not found');
		error.statusCode = 404;
		throw error;
	}
	return product;
}

async function getCurrentUser(userId) {
	return User.findById(userId).select('name email avatarUrl role status');
}

exports.getProductReviews = async (req, res) => {
	try {
		const { productId } = req.params;

		await ensureProductExists(productId);

		const reviews = await Review.find({ product: productId })
			.populate('user', 'name email avatarUrl')
			.sort({ createdAt: -1 });

		res.json(reviews.map(formatReview));
	} catch (error) {
		res.status(error.statusCode || 500).json({
			message: error.message || 'Failed to load reviews',
		});
	}
};

exports.createProductReview = async (req, res) => {
	try {
		const { productId } = req.params;
		const userId = req.user?.id;
		const { rating, comment } = req.body;

		if (!userId) {
			return res.status(401).json({ message: 'Not authenticated' });
		}

		const parsedRating = Number(rating);
		if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
			return res.status(400).json({ message: 'Rating must be an integer between 1 and 5' });
		}

		await ensureProductExists(productId);
		const currentUser = await getCurrentUser(userId);
		if (!currentUser) {
			return res.status(401).json({ message: 'User not found' });
		}

		const payload = {
			product: productId,
			user: userId,
			rating: parsedRating,
			comment: typeof comment === 'string' ? comment.trim() : '',
		};

		const review = await Review.create(payload);

		await updateProductReviewSummary(productId);

		const populatedReview = await Review.findById(review._id).populate('user', 'name email avatarUrl');

		res.status(201).json(formatReview(populatedReview));
	} catch (error) {
		res.status(error.statusCode || 500).json({
			message: error.message || 'Failed to submit review',
		});
	}
};

exports.updateProductReview = async (req, res) => {
	try {
		const { productId, reviewId } = req.params;
		const userId = req.user?.id;
		const { rating, comment } = req.body;

		if (!userId) {
			return res.status(401).json({ message: 'Not authenticated' });
		}

		const parsedRating = Number(rating);
		if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
			return res.status(400).json({ message: 'Rating must be an integer between 1 and 5' });
		}

		await ensureProductExists(productId);

		const review = await Review.findOne({ _id: reviewId, product: productId }).populate('user', 'name email avatarUrl');
		if (!review) {
			return res.status(404).json({ message: 'Review not found' });
		}

		const currentUser = await getCurrentUser(userId);
		const isOwner = review.user && review.user._id && review.user._id.toString() === userId.toString();
		const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

		if (!isOwner && !isSuperAdmin) {
			return res.status(403).json({ message: 'You can only edit your own review' });
		}

		review.rating = parsedRating;
		review.comment = typeof comment === 'string' ? comment.trim() : '';
		await review.save();

		await updateProductReviewSummary(productId);

		const populatedReview = await Review.findById(review._id).populate('user', 'name email avatarUrl');
		res.json(formatReview(populatedReview));
	} catch (error) {
		res.status(error.statusCode || 500).json({
			message: error.message || 'Failed to update review',
		});
	}
};

exports.deleteProductReview = async (req, res) => {
	try {
		const { productId, reviewId } = req.params;
		const userId = req.user?.id;

		if (!userId) {
			return res.status(401).json({ message: 'Not authenticated' });
		}

		const review = await Review.findOne({ _id: reviewId, product: productId }).populate('user', 'name email avatarUrl');
		if (!review) {
			return res.status(404).json({ message: 'Review not found' });
		}

		const currentUser = await getCurrentUser(userId);
		const isOwner = review.user && review.user._id && review.user._id.toString() === userId.toString();
		const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

		if (!isOwner && !isSuperAdmin) {
			return res.status(403).json({ message: 'You can only delete your own review' });
		}

		await Review.deleteOne({ _id: reviewId, product: productId });
		await updateProductReviewSummary(productId);

		res.json({
			message: 'Review deleted successfully',
			data: formatReview(review),
		});
	} catch (error) {
		res.status(error.statusCode || 500).json({
			message: error.message || 'Failed to delete review',
		});
	}
};
