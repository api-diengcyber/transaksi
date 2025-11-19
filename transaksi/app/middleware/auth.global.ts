// middleware/auth.global.ts
export default defineNuxtRouteMiddleware((to, from) => {
    const accessToken = useCookie('accessToken');
    const refreshToken = useCookie('refreshToken'); // Cek juga refresh token

    const publicRoutes = ['/login', '/install'];
    const isPublicRoute = publicRoutes.includes(to.path);

    // Jika tidak ada akses token DAN tidak ada refresh token
    if (!accessToken.value && !refreshToken.value) {
        if (!isPublicRoute) {
            return navigateTo('/login');
        }
    } else {
        // Jika user sudah login (ada salah satu token)
        if (to.path === '/login') {
            return navigateTo('/');
        }
    }
});