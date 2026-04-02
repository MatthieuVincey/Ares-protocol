# 🌍 Mettre en Ligne ARES PROTOCOL sur Render (Gratuit)

Votre projet est désormais **100% prêt à être déployé sur [Render](https://render.com/)**, une excellente plateforme gratuite pour héberger un jeu Node.js. Aucune configuration complexe n'est requise grâce aux derniers ajustements apportés au code.

Suivez ces quelques étapes :

---

## ÉTAPE 1 : Pousser le code sur GitHub
Render a besoin de lire votre code source. La méthode standard est d'utiliser GitHub.

1. Allez sur [GitHub](https://github.com/) et créez-vous un compte si ce n'est pas déjà fait.
2. Cliquez sur le bouton vert **"New"** pour créer un nouveau dépôt (Repository).
3. Donnez-lui le nom **`ares-protocol`** et cliquez sur "Create repository".
4. Poussez votre code. Ouvrez votre terminal, placez-vous dans votre dossier `/Users/garcons/antigravity/prajet 2` et lancez :
```bash
git remote add origin https://github.com/VOTRE-COMPTE/ares-protocol.git
git branch -M main
git push -u origin main
```

*(Assurez-vous que tous vos fichiers sont bien uploadés sur GitHub).*

---

## ÉTAPE 2 : Déploiement sur Render

1. Rendez-vous sur [Render.com](https://render.com/) et connectez-vous (vous pouvez utiliser votre compte GitHub pour aller plus vite).
2. Cliquez sur le bouton **"New +"** en haut à droite, puis sélectionnez **"Web Service"**.
3. Choisissez **"Build and deploy from a Git repository"** et cliquez sur Next.
4. Connectez votre compte GitHub et sélectionnez votre dépôt **`ares-protocol`**.
5. Remplissez le formulaire de configuration :
   - **Name** : `ares-protocol` (ou le nom public de votre choix)
   - **Region** : Frankfurt (si vous êtes en Europe) ou la plus proche de chez vous.
   - **Branch** : `main`
   - **Runtime** : `Node`
   - **Build Command** : `npm install`
   - **Start Command** : `npm start` *(C'est la commande que nous avons configurée dans le package.json)*
   - **Instance Type** : `Free` (Gratuit).
6. Cliquez sur le bouton **"Create Web Service"** en bas.

---

## ÉTAPE 3 : Jouer !

1. Render va maintenant télécharger votre code, installer les dépendances (Express, ws, uuid) et lancer le serveur `server.js`.
2. Laissez-lui 1 ou 2 minutes. En haut à gauche de l'interface, vous verrez une URL générée automatiquement, ressemblant à :
   **`https://ares-protocol.onrender.com`**
3. **Cliquez sur le lien !** 
   - Le jeu va se charger.
   - Grâce à notre modification réseau, le code transformera mathématiquement l'URL en **`wss://ares-protocol.onrender.com`** pour brancher le système multijoueur.
4. **Partagez ce lien à vos amis**. Quand ils cliquent, ils atterrissent sur votre partie en direct !

---

> [!WARNING]
> **Limitations de l'hébergement gratuit (Render Free Tier)**
> 
> *   **Mise en veille** : Si personne ne joue pendant 15 minutes, le serveur s'éteint. Lorsque vous (ou un ami) cliquerez sur le lien après une pause, le jeu mettra **jusqu'à 50 secondes** à se lancer le temps que le serveur se réveille. C'est normal.
> *   **Garde partagée** : Toute la logique mondiale (ressources, temps) n'existe que tant que le serveur est éveillé. À la fermeture, le serveur sera réinitialisé (pour l'instant, puisqu'il n'y a pas de base de données persistante connectée).
