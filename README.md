# CartShare

A collaborative shared-cart web app for dorms, offices, and travel groups. Create a room, share the code, and everyone can add items to one running cart, watch a live activity feed, track progress toward a free-shipping threshold, and print an itemized receipt when the order is ready.

## Running it locally

No build step or server required — it's a static site.

**Option 1: Open directly**
Double-click `index.html`, or open it in your browser via `File > Open`.

**Option 2: Local server (recommended for testing multi-tab sync)**
From this folder, run one of:

```bash
python3 -m http.server 8000
# or
npx serve .
```

Then visit `http://localhost:8000` in your browser.

## How to use it

1. Enter your name.
2. Click **Create new room** to start a room and get a share code, or enter a code a teammate gave you and click **Join room**.
3. Add items with a name, quantity, and price. Everyone in the room sees the cart update.
4. Watch the **Activity** panel for a log of who joined and who added or removed what.
5. The **free-shipping threshold** bar fills as the cart subtotal approaches $75.
6. Click **Generate receipt** to see an itemized, per-person split, then **Print** to get a clean printout (browser print dialog).
7. **Leave room** returns you to the join/create screen. Reopening the app in the same browser reconnects you to your last room automatically.

To see real-time sync in action, open `index.html` in two browser tabs and join the same room code in both — items, activity, and totals update in both tabs.

## Features implemented

- **User access**: name entry plus room creation/joining, no backend required
- **Responsive UI**: CSS Grid and Flexbox layout that collapses to a single column on mobile
- **Data persistence**: cart, participants, and activity log are saved to the browser's `localStorage`, so a reload doesn't lose the room
- **Collaboration across tabs**: a `storage` event listener plus a light polling fallback keep every open tab for a room in sync in real time
- **Printable receipt**: itemized modal with per-item attribution and an even-split total, styled with a `@media print` rule for a clean printout
- **Light/dark aware**: color tokens adapt to the system's light/dark preference

## Known limitations

This is a front-end-only prototype. `localStorage` is scoped to a single browser, so "real-time" sync works across tabs/windows on the same computer but not across different people's devices. Making the "Room" feature work across separate devices (as called for in the live-deployment testing step) needs a small backend or a realtime service such as Firebase or Supabase to broadcast state between clients — that's a natural next step once this prototype is deployed.

## Folder structure

```
.
├── index.html        # markup + entry point
├── css/
│   └── style.css      # all styling, layout, and print rules
├── js/
│   └── app.js          # room/cart/receipt logic, storage, and sync
├── assets/             # (empty — reserved for any icons/images you add)
└── README.md
```
