export default defineNuxtRouteMiddleware((to, from) => {
    // Ambil token dari localStorage
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');

    const publicRoutes = ['/login', '/install'];
    const isPublicRoute = publicRoutes.includes(to.path);

    // Jika tidak ada akses token DAN tidak ada refresh token (User Londo/Kosong)
    if (!accessToken && !refreshToken) {
        if (!isPublicRoute) {
            console.log('🚫 No tokens found, redirecting to login...');
            return navigateTo('/login');
        }
    } else {
        // Jika user sudah login (Ulihan / Ada token)
        if (to.path === '/login') {
            console.log('✅ User already logged in, redirecting to home...');
            return navigateTo('/');
        }
    }
});