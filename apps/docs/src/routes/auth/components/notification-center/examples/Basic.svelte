<script lang="ts">
  import { NotificationCenter } from '@urbicon-ui/auth';

  const demoNotifications = [
    {
      id: '1',
      userId: 'demo',
      title: 'Welcome!',
      body: 'Your account has been created.',
      type: 'system',
      typeKey: 'welcome',
      url: null,
      icon: null,
      createdAt: new Date(Date.now() - 5 * 60000),
      readAt: null
    },
    {
      id: '2',
      userId: 'demo',
      title: 'New feature available',
      body: 'Passkey login is now supported.',
      type: 'system',
      typeKey: 'feature',
      url: null,
      icon: null,
      createdAt: new Date(Date.now() - 3600000),
      readAt: new Date()
    }
  ];
</script>

<NotificationCenter
  notifications={demoNotifications}
  onMarkAsRead={(id) => console.log('Mark as read:', id)}
  onMarkAllAsRead={() => console.log('Mark all as read')}
  onDelete={(id) => console.log('Delete:', id)}
/>
