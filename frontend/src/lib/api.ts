export type { Tokens, PaginatedResponse } from '@/lib/api/core'
export { ApiError, clearStoredTokens, getStoredTokens, setStoredTokens } from '@/lib/api/core'

export type {
    Address,
    AggregateReport,
    CartItem,
    CartSummary,
    Category,
    ImageAsset,
    Order,
    OrderEvent,
    Product,
    RefundRequest,
    Review,
    SavedItem,
    User,
    UserInvite,
    WishlistItem,
} from '@/lib/api/types'

export { fetchAggregateReport, fetchCurrentUser, login, logout, register, requestPasswordReset } from '@/lib/api/auth'

export {
    createUser,
    createUserInvite,
    deleteUser,
    exportUsersCsv,
    fetchUserOrders,
    fetchUsers,
    importUsersCsv,
    updateUser,
    updateUserProfile,
} from '@/lib/api/users'

export {
    archiveProduct,
    createProduct,
    deleteImage,
    deleteProduct,
    exportProductsCsv,
    fetchImage,
    fetchImages,
    fetchProducts,
    importProductsCsv,
    setProductImages,
    updateImage,
    updateProduct,
    uploadImage,
} from '@/lib/api/products'

export {
    approveOrderRefund,
    cancelOrder,
    deliverOrder,
    fetchOrderInvoice,
    fetchOrders,
    fetchOrderTimeline,
    markOrderPaid,
    payOrder,
    refundOrder,
    shipOrder,
} from '@/lib/api/orders'

export {
    createCategory,
    deleteCategory,
    fetchAddresses,
    fetchCartItems,
    fetchCategories,
    fetchReviews,
    fetchSavedItems,
    fetchWishlistItems,
    updateCategory,
} from '@/lib/api/catalog'

export {
    addSavedItem,
    addWishlistItem,
    changePassword,
    checkout,
    createAddress,
    createReview,
    customerCancelOrder,
    customerPayOrder,
    customerRefundOrder,
    deleteAddress,
    fetchAddressesForMe,
    fetchCart,
    fetchCartSummary,
    fetchMe,
    fetchMyOrderInvoice,
    fetchMyOrders,
    fetchMyOrderTimeline,
    fetchProductReviews,
    fetchPublicCategories,
    fetchSaved,
    fetchStoreProducts,
    fetchStoreProduct,
    fetchWishlist,
    removeCartItem,
    removeSavedItem,
    removeWishlistItem,
    updateAddress,
    updateCartItem,
    updateMe,
    upsertCartItem,
} from '@/lib/api/customer'
