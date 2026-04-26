import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ShoppingCart, Star, ChevronLeft, Check, Package, 
  Truck, Shield, MessageSquare, Loader2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import Navbar from '@/components/layout/Navbar';
import { useStore } from '@/store/useStore';
import { useAuth } from '@/hooks/useAuth';
import { api, ApiProduct, ApiReview } from '@/lib/api';
import { formatLKR } from '@/lib/currency';
import { useToast } from '@/hooks/use-toast';

const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { addToCart } = useStore();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [product, setProduct] = useState<ApiProduct | null>(null);
  const [reviews, setReviews] = useState<ApiReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      const isObjectId = /^[a-fA-F0-9]{24}$/.test(id);
      if (!isObjectId) {
        setProduct(null);
        setLoading(false);
        return;
      }

      try {
        const productData = await api.getProduct(id);
        setProduct(productData);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Failed to fetch product:', message);
        setProduct(null);
        setLoading(false);
        return;
      }

      try {
        const reviewsData = await api.getProductReviews(id);
        setReviews(reviewsData || []);
      } catch {
        // Reviews endpoints are optional in current backend; do not block product details.
        setReviews([]);
      }

      setLoading(false);
    };

    fetchProduct();
  }, [id]);

  const handleAddToCart = () => {
    if (!product) return;
    
    addToCart({
      id: product.id || product._id || '',
      product: {
        id: product.id || product._id || '',
        name: product.name,
        description: product.description || '',
        price: product.price,
        image: product.imageUrl || '/placeholder.svg',
        category: product.category?.name || 'Uncategorized',
        brand: '',
        shopId: product.shopId,
        shopName: product.shop?.name || 'Unknown Shop',
        stock: product.stock,
        compatibleVehicles: product.compatibleVariants || [],
        rating: 0,
        reviewCount: 0,
        sku: product.sku || '',
      },
      quantity: 1
    });
    
    toast({
      title: 'Added to Cart',
      description: `${product.name} has been added to your cart.`,
    });
  };

  const handleSubmitReview = async () => {
    if (!user || !product) {
      toast({
        title: 'Sign In Required',
        description: 'Please sign in to leave a review.',
        variant: 'destructive',
      });
      return;
    }

    setSubmittingReview(true);
    
    try {
      const productId = product.id || product._id || '';
      await api.createProductReview(productId, {
        rating: newRating,
        comment: newComment || undefined,
      });

      toast({
        title: 'Review Submitted',
        description: 'Thank you for your feedback!',
      });
      
      // Refresh reviews
      const reviewsData = await api.getProductReviews(productId);
      setReviews(reviewsData || []);
      
      setNewComment('');
      setNewRating(5);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to submit review';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    }
    
    setSubmittingReview(false);
  };

  const averageRating = reviews.length > 0 
    ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length 
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container py-16 text-center">
          <h1 className="text-2xl font-bold">Product Not Found</h1>
          <Link to="/shop">
            <Button className="mt-4">Back to Shop</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container py-8">
        {/* Breadcrumb */}
        <Link to="/shop" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary mb-6">
          <ChevronLeft className="h-4 w-4" />
          Back to Shop
        </Link>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Product Image */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative"
          >
            <div className="aspect-square rounded-2xl overflow-hidden glass-card">
              <img
                src={product.imageUrl || '/placeholder.svg'}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>
          </motion.div>

          {/* Product Info */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div>
              <p className="text-primary text-sm font-medium mb-2">{product.shop?.name}</p>
              <h1 className="text-3xl font-display font-bold text-foreground mb-2">
                {product.name}
              </h1>
              
              {/* Rating */}
              <div className="flex items-center gap-2">
                <div className="flex items-center">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-5 w-5 ${
                        star <= Math.round(averageRating)
                          ? 'fill-yellow-500 text-yellow-500'
                          : 'text-muted-foreground'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-muted-foreground">
                  ({reviews.length} review{reviews.length !== 1 ? 's' : ''})
                </span>
              </div>
            </div>

            <div className="text-4xl font-bold text-primary">
              {formatLKR(product.price)}
            </div>

            <p className="text-muted-foreground leading-relaxed">
              {product.description || 'No description available.'}
            </p>

            {/* Stock Badge */}
            <div className="flex items-center gap-2">
              {product.stock > 0 ? (
                <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                  <Check className="h-3 w-3 mr-1" />
                  In Stock ({product.stock} available)
                </Badge>
              ) : (
                <Badge variant="destructive">Out of Stock</Badge>
              )}
            </div>

            {/* Features */}
            <div className="grid grid-cols-3 gap-4 py-4 border-y border-border/50">
              <div className="flex flex-col items-center text-center p-3">
                <Package className="h-6 w-6 text-primary mb-2" />
                <span className="text-xs text-muted-foreground">Quality Parts</span>
              </div>
              <div className="flex flex-col items-center text-center p-3">
                <Truck className="h-6 w-6 text-primary mb-2" />
                <span className="text-xs text-muted-foreground">Fast Delivery</span>
              </div>
              <div className="flex flex-col items-center text-center p-3">
                <Shield className="h-6 w-6 text-primary mb-2" />
                <span className="text-xs text-muted-foreground">Warranty</span>
              </div>
            </div>

            {/* Add to Cart */}
            <Button
              size="lg"
              className="w-full"
              onClick={handleAddToCart}
              disabled={product.stock === 0}
            >
              <ShoppingCart className="h-5 w-5 mr-2" />
              Add to Cart
            </Button>

            {/* Specifications */}
            {product.specifications && Object.keys(product.specifications).length > 0 && (
              <div className="glass-card rounded-xl p-4">
                <h3 className="font-semibold mb-3">Specifications</h3>
                <dl className="space-y-2">
                  {Object.entries(product.specifications).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm">
                      <dt className="text-muted-foreground">{key}</dt>
                      <dd className="font-medium">{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </motion.div>
        </div>

        {/* Reviews Section */}
        <div className="mt-16">
          <h2 className="text-2xl font-display font-bold mb-6 flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            Customer Reviews
          </h2>

          {/* Write Review */}
          {user && (
            <div className="glass-card rounded-xl p-6 mb-8">
              <h3 className="font-semibold mb-4">Write a Review</h3>
              
              <div className="space-y-4">
                <div>
                  <Label>Rating</Label>
                  <div className="flex items-center gap-1 mt-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setNewRating(star)}
                        className="focus:outline-none"
                      >
                        <Star
                          className={`h-8 w-8 transition-colors ${
                            star <= newRating
                              ? 'fill-yellow-500 text-yellow-500'
                              : 'text-muted-foreground hover:text-yellow-500'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Comment</Label>
                  <Textarea
                    placeholder="Share your experience with this product..."
                    className="mt-2"
                    rows={4}
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                  />
                </div>

                <Button onClick={handleSubmitReview} disabled={submittingReview}>
                  {submittingReview ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Submit Review
                </Button>
              </div>
            </div>
          )}

          {/* Reviews List */}
          {reviews.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No reviews yet. Be the first to review this product!
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card rounded-xl p-6"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold">{review.user?.fullName || 'Anonymous'}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-4 w-4 ${
                            star <= review.rating
                              ? 'fill-yellow-500 text-yellow-500'
                              : 'text-muted-foreground'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  {review.comment && (
                    <p className="text-muted-foreground">{review.comment}</p>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
