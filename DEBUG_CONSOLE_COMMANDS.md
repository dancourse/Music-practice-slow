# Debug Console Commands

Open your browser console (F12 → Console tab) and run these commands to check what's happening:

## Check Heap Connection
```javascript
// Check if Heap loaded
console.log('Heap loaded:', typeof heap !== 'undefined');
console.log('Heap object:', heap);

// Test tracking
if (heap) {
  heap.track('test_event', {test: true});
  console.log('Test event sent to Heap');
}
```

## Check Account Manager Status
```javascript
// Check account manager
console.log('Account Manager:', app.accountManager);
console.log('Account Type:', app.accountManager.accountType);
console.log('Is Paid:', app.accountManager.isPaid());
console.log('Video Count:', app.videos.length);

// Check localStorage
console.log('localStorage account type:', localStorage.getItem('musicPracticeAccountType'));
console.log('localStorage videos:', localStorage.getItem('musicPracticeVideos'));
```

## Reset Account to Free (if needed)
```javascript
// Clear account status and reset to free
localStorage.removeItem('musicPracticeAccountType');
localStorage.removeItem('musicPracticeLicenseKey');
localStorage.removeItem('musicPracticeWelcomeShown');
localStorage.removeItem('musicPracticeAccountCreated');

// Reload page
location.reload();
```

## Clear All Videos
```javascript
localStorage.removeItem('musicPracticeVideos');
location.reload();
```

## Test the Blocking
```javascript
// After resetting, try to add 2 videos and see what happens
console.log('Before adding:', app.videos.length);
console.log('Is Paid:', app.accountManager.isPaid());
console.log('Should block after 1 video:', !app.accountManager.isPaid() && app.videos.length >= 1);
```
