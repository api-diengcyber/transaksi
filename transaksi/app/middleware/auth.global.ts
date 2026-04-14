// app/middleware/auth.global.ts
export default defineNuxtRouteMiddleware((to, from) => {
    let accessToken = null;
    let refreshToken = null;
    let hasSeenWelcome = null;
    
    // Harus di dalam process.client karena localStorage tidak ada di SSR Node.js
    if (process.client) {
        hasSeenWelcome = localStorage.getItem('has_seen_welcome');
        accessToken = localStorage.getItem('accessToken');
        refreshToken = localStorage.getItem('refreshToken');
    }

    // 1. Pengecekan Halaman Welcome via localStorage
    if (hasSeenWelcome !== '1' && to.path !== '/welcome') {
        console.log('🛑 User belum melewati Welcome Page, redirecting...');
        return navigateTo('/welcome');
    }

    const publicRoutes = ['/welcome', '/login', '/install', '/system/status', '/system/logs', '/system/db-check'];
    const isPublicRoute = publicRoutes.includes(to.path);

    // 2. Jika tidak ada token (Belum Login)
    if (!accessToken && !refreshToken) {
        if (!isPublicRoute) {
            console.log('🚫 No tokens found, redirecting to login...');
            return navigateTo('/login');
        }
    } else {
        // 3. Jika user sudah login (Ada token)
        if (to.path === '/login' || to.path === '/welcome') {
            console.log('✅ User already logged in, redirecting to home...');
            return navigateTo('/');
        }
    }
});