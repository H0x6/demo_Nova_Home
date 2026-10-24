/*!
 * nova.js — comportements du design sur mesure Nova Home, chargé après gabarit.js :
 * comparateurs avant/après, photo des métiers au survol, disponibilités à jour, vérificateur de commune
 * et carte, demande de devis en quatre étapes (photos jointes), visionneuse des photos de chantier.
 * Sans dépendance, sans cookie. Mouvement réduit : aucun déplacement automatique.
 */
(function () {
  'use strict';
  var doc = document;
  var each = function (l, f) { Array.prototype.forEach.call(l, f); };
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var survol = !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);
  var echap = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var sortie = function (t) { return 1 - Math.pow(1 - t, 3); };

  /* Comparateurs avant/après -------------------------------------------
     Le cadre se tire au doigt ou à la souris ; un clic ou une tape fait glisser la poignée jusque-là.
     Le curseur (input range, invisible) porte le clavier et les lecteurs d'écran. */
  each(doc.querySelectorAll('[data-nv-aa]'), function (aa) {
    var cadre = aa.querySelector('.nv-aa-cadre');
    var range = aa.querySelector('.nv-aa-curseur');
    if (!cadre || !range) return;
    var pos = 50, raf = null, touche = false;
    var texte = function (p) { p = Math.round(p); return p <= 3 ? 'Photo après' : p >= 97 ? 'Photo avant' : p + ' % de la photo avant, ' + (100 - p) + ' % de la photo après'; };
    var poser = function (p) {
      pos = Math.max(0, Math.min(100, p));
      aa.style.setProperty('--pos', pos.toFixed(2) + '%');
      range.value = String(Math.round(pos));
      range.setAttribute('aria-valuetext', texte(pos));
    };
    var arreter = function () { if (raf) { cancelAnimationFrame(raf); raf = null; } };
    var glisser = function (cible, duree, ensuite) {
      arreter();
      if (reduce || !duree) { poser(cible); if (ensuite) ensuite(); return; }
      var depart = pos, t0 = null;
      var pas = function (t) {
        if (t0 === null) t0 = t;
        var k = Math.min(1, (t - t0) / duree);
        poser(depart + (cible - depart) * sortie(k));
        if (k < 1) raf = requestAnimationFrame(pas); else { raf = null; if (ensuite) ensuite(); }
      };
      raf = requestAnimationFrame(pas);
    };
    var depuis = function (e) { var r = cadre.getBoundingClientRect(); return (e.clientX - r.left) / r.width * 100; };
    range.addEventListener('input', function () { touche = true; arreter(); poser(+range.value); });
    var actif = null, x0 = 0, bouge = false;
    cadre.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      touche = true; arreter();
      actif = e.pointerId; x0 = e.clientX; bouge = false;
      aa.classList.add('est-tire');
      if (e.pointerType === 'mouse') { e.preventDefault(); try { cadre.setPointerCapture(actif); } catch (err) { /* rien */ } glisser(depuis(e), 200); }
    });
    cadre.addEventListener('pointermove', function (e) {
      if (e.pointerId !== actif) return;
      if (!bouge && Math.abs(e.clientX - x0) < 4) return;
      if (!bouge && e.pointerType !== 'mouse') { try { cadre.setPointerCapture(actif); } catch (err) { /* rien */ } }
      bouge = true; arreter(); poser(depuis(e));
    });
    var fin = function (e) {
      if (e.pointerId !== actif) return;
      // Une tape sans glisser : la poignée va jusqu'au point touché
      if (e.type === 'pointerup' && !bouge && e.pointerType !== 'mouse') glisser(depuis(e), 220);
      actif = null; aa.classList.remove('est-tire');
    };
    cadre.addEventListener('pointerup', fin);
    cadre.addEventListener('pointercancel', fin);
    cadre.addEventListener('dragstart', function (e) { e.preventDefault(); });
    poser(50);
    // Invitation : la poignée fait un aller-retour quand le comparateur arrive à l'écran (une fois)
    if (aa.hasAttribute('data-nv-aa-inviter') && !reduce && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (en) {
        if (!en[0].isIntersecting) return;
        io.disconnect();
        setTimeout(function () { if (touche) return; glisser(62, 420, function () { if (!touche) glisser(42, 520, function () { if (!touche) glisser(50, 380); }); }); }, 450);
      }, { threshold: 0.6 });
      io.observe(aa);
    }
  });

  /* Ce que nous faisons : la photo du métier survolé ou atteint au clavier (grand écran) */
  var liste = doc.querySelector('.nv-presta-liste');
  var vitrines = doc.querySelectorAll('[data-nv-vitrine]');
  if (liste && vitrines.length) {
    var activer = function (i) {
      each(vitrines, function (v) {
        var on = +v.getAttribute('data-nv-vitrine') === i;
        if (on) {
          var img = v.querySelector('img[data-src]');
          if (img) { if (img.getAttribute('data-srcset')) img.setAttribute('srcset', img.getAttribute('data-srcset')); img.src = img.getAttribute('data-src'); img.removeAttribute('data-src'); img.removeAttribute('data-srcset'); }
        }
        v.classList.toggle('est-active', on);
      });
      each(liste.querySelectorAll('[data-nv-presta]'), function (li) { li.classList.toggle('est-active', +li.getAttribute('data-nv-presta') === i); });
    };
    each(liste.querySelectorAll('[data-nv-presta]'), function (li) {
      var i = +li.getAttribute('data-nv-presta');
      if (survol) li.addEventListener('mouseenter', function () { activer(i); });
      li.addEventListener('focusin', function () { activer(i); });
    });
    activer(0);
  }

  /* Barre d'actions du bas (téléphone) : masquée tant que les boutons de la page sont à l'écran,
     elle reprend le relais dès qu'ils sortent de l'écran */
  var barre = doc.querySelector('.nv-actionbar');
  var boutons = doc.querySelectorAll('.nv-hero-actions, .nv-appel .pv-actions');
  if (barre && boutons.length && 'IntersectionObserver' in window) {
    var visibles = [];
    var io = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (en) {
        var i = visibles.indexOf(en.target);
        if (en.isIntersecting && i < 0) visibles.push(en.target);
        if (!en.isIntersecting && i >= 0) visibles.splice(i, 1);
      });
      barre.classList.toggle('est-masque', visibles.length > 0);
    });
    each(boutons, function (b) { io.observe(b); });
  }

  /* Étapes d'un chantier : sur téléphone elles défilent de côté ; le clavier doit pouvoir les atteindre */
  each(doc.querySelectorAll('.nv-m-etapes'), function (ol) {
    var maj = function () {
      var defile = ol.scrollWidth > ol.clientWidth + 1;
      if (defile) { ol.tabIndex = 0; ol.setAttribute('aria-label', 'Les étapes du chantier, à faire défiler'); }
      else { ol.removeAttribute('tabindex'); ol.removeAttribute('aria-label'); }
    };
    maj();
    window.addEventListener('resize', maj);
  });

  /* Disponibilités : les semaines finies disparaissent, le prochain créneau libre suit la date du jour.
     S'il ne reste aucune semaine à venir, le planning et les annonces de créneau se masquent. */
  var DJ = doc.getElementById('nv-dispo');
  if (DJ) {
    var DS = null;
    try { DS = JSON.parse(DJ.textContent).semaines; } catch (err) { DS = null; }
    if (DS && DS.length) {
      var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
      var auj = new Date(); auj.setHours(12, 0, 0, 0);
      var finie = function (du) { var d = new Date(du + 'T12:00:00'); d.setDate(d.getDate() + 6); return d < auj; };
      var avenir = DS.filter(function (x) { return !finie(x.du); });
      var libre = null;
      for (var k = 0; k < avenir.length; k++) if (avenir[k].etat !== 'complet') { libre = avenir[k]; break; }
      each(doc.querySelectorAll('[data-nv-planning] [data-du]'), function (li) { if (finie(li.getAttribute('data-du'))) li.hidden = true; });
      each(doc.querySelectorAll('[data-nv-planning]'), function (p) { if (!avenir.length) p.hidden = true; });
      each(doc.querySelectorAll('[data-nv-dispo]'), function (p) {
        if (!libre) { p.hidden = true; return; }
        var d = new Date(libre.du + 'T12:00:00');
        var t = p.querySelector('[data-nv-dispo-texte]');
        if (t) t.textContent = (d <= auj ? 'cette semaine' : 'semaine du ' + d.getDate() + (d.getDate() === 1 ? 'er' : '') + ' ' + MOIS[d.getMonth()]);
      });
    }
  }

  /* Communes du Haut-Rhin : vérificateur, carte, champ « commune » du devis ---------------------- */
  var CJ = doc.getElementById('nv-communes');
  var Z = null;
  try { Z = CJ ? JSON.parse(CJ.textContent) : null; } catch (err) { Z = null; }
  var norm = function (s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\(\s*\d{5}\s*\)/g, ' ').replace(/\bste\b/g, 'sainte').replace(/\bst\b/g, 'saint')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  };
  // Réponse pour un texte saisi : { etat: 'oui' | 'non' | '', texte, commune }
  var chercher = function (saisie) {
    var q = norm(saisie);
    if (!Z || !q) return { etat: '', texte: '' };
    var tel = Z.tel ? ' au ' + Z.tel : '';
    var liste = Z.communes;
    var trouve = null;
    if (/^\d{5}$/.test(q)) {
      var memeCp = liste.filter(function (c) { return c[1] === q; });
      if (!memeCp.length) return { etat: 'non', texte: q.slice(0, 2) === '68' ? 'Ce code postal ne correspond à aucune commune du Haut-Rhin. Vérifiez-le, ou appelez-nous' + tel + '.' : 'Le code postal ' + q + ' n’est pas dans le Haut-Rhin. Appelez-nous' + tel + ' pour en parler.' };
      if (memeCp.length === 1) trouve = memeCp[0];
      else return { etat: 'oui', texte: 'Oui, nous intervenons dans tout le ' + q + ' : ' + memeCp.slice(0, 6).map(function (c) { return c[0]; }).join(', ') + (memeCp.length > 6 ? '…' : '.'), commune: memeCp[0] };
    }
    if (!trouve) {
      for (var i = 0; i < liste.length; i++) if (norm(liste[i][0]) === q) { trouve = liste[i]; break; }
    }
    if (!trouve) {
      var debut = liste.filter(function (c) { return norm(c[0]).indexOf(q) === 0; });
      if (debut.length === 1) trouve = debut[0];
      else if (debut.length > 1 && q.length >= 3) return { etat: '', texte: 'Plusieurs communes commencent ainsi : ' + debut.slice(0, 5).map(function (c) { return c[0]; }).join(', ') + (debut.length > 5 ? '…' : '.') + ' Précisez.' };
    }
    if (!trouve) return { etat: 'non', texte: 'Nous ne trouvons pas « ' + saisie.trim() + ' » dans le Haut-Rhin. Vérifiez l’orthographe, ou appelez-nous' + tel + '.' };
    if (trouve[4] === 0) return { etat: 'oui', texte: 'C’est notre commune : nous sommes installés à ' + trouve[0] + '.', commune: trouve, unique: true };
    return { etat: 'oui', texte: 'Oui, nous intervenons à ' + trouve[0] + ' (' + trouve[1] + '), à environ ' + trouve[4] + ' km de ' + Z.base + '.', commune: trouve, unique: true };
  };
  var remplirListe = function (dl) {
    if (!Z || !dl || dl.options.length) return;
    var f = doc.createDocumentFragment();
    Z.communes.forEach(function (c) { var o = doc.createElement('option'); o.value = c[0]; o.label = c[1]; f.appendChild(o); });
    dl.appendChild(f);
  };
  var montrerSurCarte = function (scope, c) {
    var cible = (scope || doc).querySelector('[data-nv-cible]') || doc.querySelector('[data-nv-cible]');
    if (!cible) return;
    if (!c) { cible.setAttribute('hidden', ''); return; }
    cible.removeAttribute('hidden');
    each(cible.querySelectorAll('circle'), function (k) { k.setAttribute('cx', c[2]); k.setAttribute('cy', c[3]); });
  };
  each(doc.querySelectorAll('[data-nv-verif]'), function (f) {
    var champ = f.querySelector('input');
    var rep = f.querySelector('[data-nv-verif-reponse]');
    var zone = f.closest('.nv-zone-grille') || doc;
    remplirListe(f.querySelector('datalist'));
    var verifier = function () {
      var r = chercher(champ.value);
      rep.textContent = r.texte;
      if (r.etat) rep.setAttribute('data-etat', r.etat); else rep.removeAttribute('data-etat');
      montrerSurCarte(zone, r.etat === 'oui' ? r.commune : null);
    };
    f.addEventListener('submit', function (e) { e.preventDefault(); verifier(); });
    // Choix dans la liste proposée : la réponse vient tout de suite
    champ.addEventListener('change', verifier);
  });

  /* Carte : un chantier s'ouvre au clic de souris (repères trop proches pour le doigt ; la légende mène aux réalisations) */
  each(doc.querySelectorAll('[data-nv-lien]'), function (m) {
    m.addEventListener('click', function () { location.href = m.getAttribute('data-nv-lien'); });
  });

  /* Visionneuse des photos de chantier --------------------------------- */
  var dlg = doc.querySelector('[data-nv-visionneuse]');
  if (dlg && typeof dlg.showModal === 'function') {
    var vImg = dlg.querySelector('.nv-vis-img'), vLeg = dlg.querySelector('.nv-vis-legende'), vCpt = dlg.querySelector('.nv-vis-compte');
    var groupe = [], idx = 0, retour = null;
    var afficher = function (i) {
      idx = (i + groupe.length) % groupe.length;
      var a = groupe[idx], im = a.querySelector('img');
      vImg.src = a.getAttribute('href');
      vImg.alt = im ? im.alt : '';
      vLeg.textContent = im ? im.alt : '';
      vCpt.textContent = groupe.length > 1 ? (idx + 1) + ' / ' + groupe.length : '';
      each(dlg.querySelectorAll('[data-nv-prec], [data-nv-suiv]'), function (b) { b.hidden = groupe.length < 2; });
    };
    var fermer = function () { if (dlg.open) dlg.close(); };
    dlg.addEventListener('close', function () { doc.documentElement.style.overflow = ''; vImg.removeAttribute('src'); if (retour) retour.focus(); });
    each(doc.querySelectorAll('[data-nv-agrandir]'), function (a) {
      a.addEventListener('click', function (e) {
        if (e.ctrlKey || e.metaKey || e.shiftKey) return;
        e.preventDefault();
        var g = a.getAttribute('data-groupe');
        groupe = Array.prototype.filter.call(doc.querySelectorAll('[data-nv-agrandir]'), function (x) { return x.getAttribute('data-groupe') === g; });
        retour = a;
        afficher(groupe.indexOf(a));
        doc.documentElement.style.overflow = 'hidden';
        dlg.showModal();
      });
    });
    dlg.querySelector('[data-nv-prec]').addEventListener('click', function () { afficher(idx - 1); });
    dlg.querySelector('[data-nv-suiv]').addEventListener('click', function () { afficher(idx + 1); });
    dlg.querySelector('[data-nv-fermer]').addEventListener('click', fermer);
    dlg.addEventListener('click', function (e) { if (e.target === dlg) fermer(); });
    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft' && groupe.length > 1) { e.preventDefault(); afficher(idx - 1); }
      if (e.key === 'ArrowRight' && groupe.length > 1) { e.preventDefault(); afficher(idx + 1); }
    });
    // Glisser à gauche ou à droite sur la photo (téléphone)
    var sx = null;
    dlg.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') sx = e.clientX; });
    dlg.addEventListener('pointerup', function (e) { if (sx === null) return; var d = e.clientX - sx; sx = null; if (Math.abs(d) > 50 && groupe.length > 1) afficher(idx + (d < 0 ? 1 : -1)); });
  }

  /* Demande de devis en quatre étapes ---------------------------------- */
  var carteDevis = doc.querySelector('[data-nv-devis]');
  var form = doc.getElementById('pv-form');
  if (!carteDevis || !form) return;
  var etapes = form.querySelectorAll('[data-nv-etape-form]');
  var prog = carteDevis.querySelectorAll('[data-nv-prog]');
  var n = 1;
  var erreur = function (id, msg, champ) {
    var p = doc.getElementById(id);
    if (p) { p.textContent = msg || ''; p.hidden = !msg; }
    if (champ) { if (msg) champ.setAttribute('aria-invalid', 'true'); else champ.removeAttribute('aria-invalid'); }
  };
  var montrer = function (k, focus) {
    n = Math.max(1, Math.min(etapes.length, k));
    each(etapes, function (f) { if (+f.getAttribute('data-nv-etape-form') === n) f.removeAttribute('data-nv-cachee'); else f.setAttribute('data-nv-cachee', ''); });
    each(prog, function (li) { var i = +li.getAttribute('data-nv-prog'); li.classList.toggle('est-active', i === n); li.classList.toggle('est-faite', i < n); });
    if (n === etapes.length) recap();
    if (focus !== false) {
      var r = carteDevis.getBoundingClientRect();
      if (r.top < 0 || r.top > window.innerHeight * 0.5) carteDevis.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
      var lg = etapes[n - 1].querySelector('legend');
      if (lg) lg.focus({ preventScroll: true });
    }
  };
  var cocher = form.querySelectorAll('input[name="travaux[]"]');
  var commune = form.elements.commune;
  var valide = function (k) {
    if (k === 1) {
      var un = Array.prototype.some.call(cocher, function (c) { return c.checked; });
      erreur('err-travaux', un ? '' : 'Choisissez au moins un type de travaux.');
      if (!un && cocher[0]) cocher[0].focus();
      return un;
    }
    if (k === 2 && commune) {
      var ok = !!commune.value.trim();
      erreur('err-commune', ok ? '' : 'Indiquez la commune du chantier.', commune);
      if (!ok) commune.focus();
      return ok;
    }
    return true;
  };
  each(form.querySelectorAll('[data-nv-suivant]'), function (b) { b.addEventListener('click', function () { if (valide(n)) montrer(n + 1); }); });
  each(form.querySelectorAll('[data-nv-retour]'), function (b) { b.addEventListener('click', function () { montrer(n - 1); }); });
  each(cocher, function (c) { c.addEventListener('change', function () { if (Array.prototype.some.call(cocher, function (x) { return x.checked; })) erreur('err-travaux', ''); }); });
  // Entrée dans un champ d'une étape : passe à la suivante au lieu d'envoyer le formulaire
  form.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || n === etapes.length || e.target.tagName === 'TEXTAREA' || e.target.type === 'submit' || e.target.tagName === 'BUTTON') return;
    e.preventDefault();
    if (valide(n)) montrer(n + 1);
  });
  // Un champ à corriger (signalé par gabarit.js à l'envoi) : son étape s'affiche d'abord
  form.addEventListener('pv:invalide', function (e) {
    var f = e.detail && e.detail.champ && e.detail.champ.closest('[data-nv-etape-form]');
    if (f) montrer(+f.getAttribute('data-nv-etape-form'), false);
  });
  // Lien « Demander un devis pour ces travaux » : ?travaux=enrobe coche la case correspondante
  try {
    var pre = new URLSearchParams(location.search).get('travaux');
    if (pre) each(cocher, function (c) { if (c.getAttribute('data-id') === pre) c.checked = true; });
  } catch (err) { /* ancien navigateur */ }

  // Commune : la réponse du vérificateur sous le champ
  if (commune) {
    remplirListe(doc.getElementById(commune.getAttribute('list')));
    var repC = form.querySelector('[data-nv-commune-reponse]');
    var majC = function () {
      if (!repC) return;
      var r = chercher(commune.value);
      // Commune reconnue : son nom officiel et son code postal dans le champ (« cernay » → « Cernay (68700) »)
      if (r.unique) commune.value = r.commune[0] + ' (' + r.commune[1] + ')';
      repC.textContent = r.etat ? r.texte : '';
      if (r.etat) repC.setAttribute('data-etat', r.etat); else repC.removeAttribute('data-etat');
      if (commune.value.trim()) erreur('err-commune', '', commune);
    };
    commune.addEventListener('change', majC);
    commune.addEventListener('blur', majC);
  }

  // Photos du terrain : réduites dans le navigateur (1600 px, JPEG) avant l'envoi, aperçus supprimables
  var zonePh = form.querySelector('[data-nv-photos]');
  var photos = [];
  var MAX = 6;
  var reduire = function (file) {
    return new Promise(function (ok) {
      if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) return ok({ blob: file, nom: file.name });
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var r = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
        var cv = doc.createElement('canvas');
        cv.width = Math.round(img.naturalWidth * r); cv.height = Math.round(img.naturalHeight * r);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        if (!cv.toBlob) return ok({ blob: file, nom: file.name });
        cv.toBlob(function (b) { ok({ blob: b && b.size < file.size ? b : file, nom: file.name }); }, 'image/jpeg', 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); ok({ blob: file, nom: file.name }); };
      img.src = url;
    });
  };
  if (zonePh) {
    var champPh = zonePh.querySelector('input[type="file"]');
    var listePh = zonePh.querySelector('[data-nv-photos-liste]');
    var dessiner = function () {
      listePh.textContent = '';
      photos.forEach(function (p, i) {
        var li = doc.createElement('li');
        var apercu = /^image\/(jpeg|png|webp)$/i.test(p.blob.type || '') ? '<img src="' + p.url + '" alt="">' : '<span class="nv-photo-fichier">' + echap(p.nom) + '</span>';
        li.innerHTML = apercu + '<button type="button" aria-label="Retirer la photo ' + (i + 1) + '">×</button>';
        li.querySelector('button').addEventListener('click', function () {
          URL.revokeObjectURL(photos[i].url);
          photos.splice(i, 1);
          dessiner();
          champPh.focus();
        });
        listePh.appendChild(li);
      });
      erreur('err-photos', photos.length >= MAX ? 'Six photos au plus : retirez-en une pour en ajouter une autre.' : '');
    };
    champPh.addEventListener('change', function () {
      var fichiers = Array.prototype.slice.call(champPh.files || []);
      champPh.value = '';
      var place = MAX - photos.length;
      if (fichiers.length > place) erreur('err-photos', 'Six photos au plus : les ' + (fichiers.length - place) + ' dernières n’ont pas été ajoutées.');
      fichiers = fichiers.filter(function (f) { return /^image\//i.test(f.type) || /\.(heic|heif)$/i.test(f.name); }).slice(0, Math.max(0, place));
      Promise.all(fichiers.map(reduire)).then(function (res) {
        res.forEach(function (r) { if (r.blob.size <= 8 * 1048576) photos.push({ blob: r.blob, nom: r.nom, url: URL.createObjectURL(r.blob) }); });
        dessiner();
      });
    });
  }
  // Envoi avec les photos (« multipart ») : gabarit.js appelle form.pvCorps quand l'envoi va au PHP du site
  form.pvCorps = function (donnees) {
    if (!photos.length) return null;
    var fd = new FormData();
    donnees.forEach(function (v, k) { fd.append(k, v); });
    photos.forEach(function (p, i) { fd.append('photos[]', p.blob, 'photo-' + (i + 1) + (/png$/i.test(p.blob.type) ? '.png' : /webp$/i.test(p.blob.type) ? '.webp' : '.jpg')); });
    return Promise.resolve(fd);
  };

  // Récapitulatif avant l'envoi
  var recap = function () {
    var box = form.querySelector('[data-nv-recap]'), dl = form.querySelector('[data-nv-recap-liste]');
    if (!box || !dl) return;
    var coches = Array.prototype.filter.call(cocher, function (c) { return c.checked; }).map(function (c) { return c.value; });
    var radio = function (nm) { var r = form.querySelector('input[name="' + nm + '"]:checked'); return r ? r.value : ''; };
    var lignes = [['Travaux', coches.join(', ')], ['Commune', commune ? commune.value.trim() : ''], ['Surface', radio('surface')], ['Accès', radio('acces')], ['Délai', radio('delai')], ['Photos', photos.length ? String(photos.length) : '']]
      .filter(function (l) { return l[1]; });
    dl.innerHTML = lignes.map(function (l) { return '<dt>' + echap(l[0]) + '</dt><dd>' + echap(l[1]) + '</dd>'; }).join('');
    box.hidden = !lignes.length;
  };

  // Envoyé : un message de confirmation remplace le formulaire
  form.addEventListener('pv:envoye', function (e) {
    var d = e.detail || {};
    var box = doc.createElement('div');
    box.className = 'nv-merci';
    box.tabIndex = -1;
    box.innerHTML = '<p class="nv-merci-titre">Votre demande de devis est envoyée.</p>' +
      '<p>Référence : <strong>' + echap(d.reference) + '</strong>. Nous vous rappelons pour parler de votre projet.</p>' +
      (d.accuse ? '<p>Une copie de votre demande vient de partir à votre adresse e-mail.</p>' : '') +
      (photos.length ? '<p>' + photos.length + ' photo' + (photos.length > 1 ? 's jointes' : ' jointe') + '.</p>' : '');
    var p0 = carteDevis.querySelector('.nv-progression');
    if (p0) p0.hidden = true;
    form.hidden = true;
    carteDevis.insertBefore(box, form);
    // Le formulaire disparaît : on remonte à la confirmation (sous l'en-tête fixe), puis le focus s'y pose
    box.focus({ preventScroll: true });
    carteDevis.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    photos.forEach(function (p) { URL.revokeObjectURL(p.url); });
    photos = [];
  });

  montrer(1, false);
})();
