export default function({ store, error }) {
  if (!store.getters.getUserId) {
    error({ statusCode: 401, message: 'LOGIN_NEEDED' });
  }
}