# Piškvorky

Piškvorky (gomoku) for two players on one phone, tablet or computer. 15×15 board, five in a row wins.
A web version of the original tkinter game: open the page in a browser, no installation needed.

## How to play

- **Tap** a cell to see a faded preview of your stone, **tap the same cell again** to place it.
  One tap always places the symbol that is on turn.
- On a computer, **left click** places kolečka (O) and **right click** places křížky (X), like in the tkinter version.
- **Zpět** undoes the last step (also `Ctrl+Z`). **Nová hra** starts again and lets you pick the opening.
- An unfinished game is kept when the page is reloaded or the phone closes the browser.

### Openings

- **Swap2** (default): Hráč 1 places 3 stones. Hráč 2 then picks **X**, **O**, or **+2**.
  With +2, Hráč 2 places 2 more stones and Hráč 1 picks the symbol.
- **Volná hra** (free game): whoever places the first stone is Hráč 1. Before the first move, the X / O buttons choose who starts.

## Put it online (GitHub Pages)

1. On GitHub open **Settings → Pages**.
2. Under **Build and deployment**, set **Source: Deploy from a branch**, **Branch: `main`**, folder **`/ (root)`**, and save.
3. After a minute the game is at `https://<your-username>.github.io/piskvorky/`.

On a phone or tablet open that link and use **Add to Home Screen** (Safari: Share button; Chrome: ⋮ menu).
It then starts full screen like an app and also works offline.

## Run it locally

Any static web server works, for example:

```sh
python3 -m http.server 8000
```

and open <http://localhost:8000>.

## Files

| File | What it does |
| --- | --- |
| `index.html` | page layout: header with players, board, X / O / +2 bar, buttons, dialogs |
| `style.css` | look and the phone / tablet layouts (portrait: board in the middle; landscape: board left, panel right) |
| `app.js` | game rules (turns, Swap2, five in a row, undo) and drawing the board |
| `sw.js`, `manifest.webmanifest`, `icons/` | home-screen app and offline support |
