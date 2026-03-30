# 🚀 Guide Multijoueur ARES (Node.js + ngrok)

Ce guide vous explique comment jouer à ARES avec un ami via Internet, en toute simplicité.

---

## 💻 1. Pour l'Hébergeur (Vous)

Vous allez faire tourner le serveur sur votre machine et l'exposer sur Internet.

**Étape A : Lancer le serveur local**
Ouvrez votre terminal dans le dossier du jeu et lancez :
```bash
node server.js
```
*Le serveur tourne maintenant sur le port 3000.*

**Étape B : Lancer ngrok pour exposer le serveur**
Ouvrez un **deuxième** terminal et lancez :
```bash
ngrok http 3000
```

Dans la console ngrok qui s'affiche, cherchez la ligne **Forwarding**. Vous y verrez une URL ressemblant à `https://1234-abcd.ngrok-free.app`.

---

## 🎮 2. Pour l'Ami (Celui qui rejoint)

Copiez l'URL ngrok (la partie `1234-abcd.ngrok-free.app`) et envoyez-la à votre ami avec tout le dossier du jeu (ou demandez-lui de modifier ce fichier).

Votre ami doit ouvrir le fichier `networkSystem.js` et modifier la **Ligne 10** comme ceci :

```javascript
// Remplacez par l'URL fournie par ngrok, en utilisant "wss://" (WebSocket Sécurisé)
const SERVER_URL = "wss://1234-abcd.ngrok-free.app"; 
```

*(L'hôte n'a pas besoin de changer ce fichier, car par défaut le jeu détectera son propre serveur local !)*

---

## 🚀 3. Jouer !

1. **L'Hébergeur** ouvre le jeu normalement (`http://localhost:3000`).
2. **L'Ami** ouvre le fichier `index.html` de son côté en local dans son navigateur.
3. Le jeu de l'ami se connectera automatiquement à travers ngrok vers le serveur de l'hébergeur. 

Vous verrez le nombre de joueurs augmenter dans le HUD et vous pourrez vous voir marcher et construire ensemble !
