// app/middleware/auth.global.ts

export default defineNuxtRouteMiddleware((to, from) => {
    // 1. [BARU] Pengecekan Halaman Welcome
    const welcomeCookie = useCookie('has_seen_welcome');
    
    // Jika user belum pernah melihat halaman welcome DAN bukan sedang menuju ke /welcome
    if (welcomeCookie.value !== '1' && to.path !== '/welcome') {
        console.log('🛑 User belum melewati Welcome Page, redirecting...');
        return navigateTo('/welcome');
    }

    // 2. Ambil token dari localStorage (hanya jalan di client-side)
    let accessToken = null;
    let refreshToken = null;
    
    if (process.client) {
        accessToken = localStorage.getItem('accessToken');
        refreshToken = localStorage.getItem('refreshToken');
    }

    const publicRoutes = ['/welcome', '/login', '/install', '/system/status', '/system/logs', '/system/db-check'];
    const isPublicRoute = publicRoutes.includes(to.path);

    // 3. Jika tidak ada token (Belum Login)
    if (!accessToken && !refreshToken) {
        if (!isPublicRoute) {
            console.log('🚫 No tokens found, redirecting to login...');
            return navigateTo('/login');
        }
    } else {
        // 4. Jika user sudah login (Ada token)
        if (to.path === '/login' || to.path === '/welcome') {
            console.log('✅ User already logged in, redirecting to home...');
            return navigateTo('/');
        }
    }
});