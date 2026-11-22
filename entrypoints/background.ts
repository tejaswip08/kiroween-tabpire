import { setupBadgeUpdates } from '@/lib/badge';

export default defineBackground(() => {
  setupBadgeUpdates();
});
