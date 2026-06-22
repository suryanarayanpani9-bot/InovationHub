# Attendance Face Authentication

A browser-based webdev project for enrolling student faces, authenticating them through webcam, and saving attendance records in `localStorage`.

## Files

- `index.html` - page structure
- `style.css` - responsive layout and styling
- `script.js` - webcam, face matching, attendance, and CSV export logic

## Run

Open this folder with a local server so the camera permission works correctly:

```bash
npx http-server
```

Then open the shown localhost URL and go to `/attendence-face-authontication/`.

## Notes

- The app loads `face-api.js` and model weights from CDN, so internet access is required.
- Data is saved only in the current browser.
- This is a learning project, not production biometric security.
