// Interazioni comuni del sito (dalla base grafica): testata, barra in fondo, visore foto, gallerie, mappe, entrate morbide.
// Calendario, date, percorsi di prenotazione e pagamento di prova stanno nei loro file e si caricano solo dove servono.
// Nessuna richiesta verso server: in questa versione il sito è scollegato (vedi LEGGIMI.md).
import { durata } from './tendine.js?v=1';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
// Arrivati col tasto indietro o ricaricando: il browser rimette la pagina dov'era, gli script non devono scorrere
const tornato = (() => {
	try {
		const t = performance.getEntriesByType('navigation')[0]?.type;
		return t === 'back_forward' || t === 'reload';
	} catch {
		return false;
	}
})();

/* Testata (11/10): in home è trasparente sulla foto grande e diventa bianca quando la foto passa sotto di lei;
   nelle altre pagine è bianca da subito (riga sottile appena si scorre). Le sezioni stanno dentro la testata. */
const header = $('[data-header]');
if (header) {
	const chiaro = header.classList.contains('mm-header--chiaro');
	const sopra = () => $('[data-sfondo]') || $('[data-slider], [data-copertina]');
	const soglia = () => (chiaro ? 4 : Math.max(40, (sopra()?.offsetHeight || 400) - header.offsetHeight));
	// Home (12/10): le sezioni stanno nella fascia sotto la foto. Telefono e tablet: quando la fascia arriva alla
	// seconda riga della testata prende il suo posto (stessa altezza, non si vede il cambio). Computer: la testata
	// diventa bianca quando la fascia la tocca e le sezioni compaiono quando la fascia le è passata sotto.
	const fascia = $('[data-sezioni-home]');
	const rigaSezioni = $('[data-chips]', header);
	const largo = matchMedia('(min-width: 1024px)');
	const aggiornaHeader = () => {
		if (!fascia || !rigaSezioni) return header.classList.toggle('is-scrolled', window.scrollY > soglia());
		const f = fascia.getBoundingClientRect();
		const fondoTestata = header.getBoundingClientRect().bottom;
		const cima = largo.matches ? fondoTestata : fondoTestata - rigaSezioni.offsetHeight;
		const con = f.bottom <= fondoTestata + 1;
		// la fila riparte da dove l'hai lasciata, scendendo (fascia → testata) e risalendo (testata → fascia)
		const prima = header.classList.contains('con-sezioni');
		if (con && !prima) $('.mm-sezioni__in', rigaSezioni).scrollLeft = $('.mm-sezioni__in', fascia).scrollLeft;
		if (!con && prima) $('.mm-sezioni__in', fascia).scrollLeft = $('.mm-sezioni__in', rigaSezioni).scrollLeft;
		header.classList.toggle('is-scrolled', f.top <= cima + 1);
		header.classList.toggle('con-sezioni', con);
	};
	addEventListener('scroll', aggiornaHeader, { passive: true });
	addEventListener('resize', aggiornaHeader, { passive: true });
	aggiornaHeader();
}

/* Barra in fondo alle pagine dei lavori (10/10): scendendo nella pagina si restringe, risalendo torna estesa.
   Cambia solo dopo un movimento di almeno 24 px nella stessa direzione: niente cambi continui per piccoli
   aggiustamenti o per il rimbalzo di Safari in cima e in fondo. */
const fondoBarra = $('[data-fondo]');
if (fondoBarra) {
	let ultimo = scrollY;
	let corsa = 0;
	const SOGLIA = 24;
	const segui = () => {
		const y = scrollY;
		const max = document.documentElement.scrollHeight - innerHeight;
		const d = y - ultimo;
		ultimo = y;
		if (y <= 40) {
			corsa = 0;
			fondoBarra.classList.remove('is-compatta');
			return;
		}
		if (y < 0 || y > max - 2) return; // rimbalzo in fondo: resta com'è
		if (d === 0) return;
		if (Math.sign(d) !== Math.sign(corsa)) corsa = 0;
		corsa += d;
		if (corsa > SOGLIA) fondoBarra.classList.add('is-compatta');
		else if (corsa < -SOGLIA) fondoBarra.classList.remove('is-compatta');
	};
	addEventListener('scroll', segui, { passive: true });
}

/* Campi numerici con + e − */
for (const box of $$('[data-stepper]')) {
	const input = $('input', box);
	// anche scritti a mano restano tra il minimo e il massimo; dove si conta uno a uno, solo numeri interi (12/10, B6)
	const limita = (finale) => {
		if (input.value === '') return;
		const min = input.min === '' ? -Infinity : Number(input.min);
		const max = input.max === '' ? Infinity : Number(input.max);
		let n = Number(input.value);
		if (!Number.isFinite(n)) return;
		if (finale && Number(input.step) === 1) n = Math.round(n);
		const giusto = Math.min(max, Math.max(min, n));
		if (giusto !== Number(input.value)) input.value = String(giusto);
	};
	input.addEventListener('input', () => limita(false));
	input.addEventListener('change', () => {
		const prima = input.value;
		limita(true);
		if (input.value !== prima) input.dispatchEvent(new Event('input', { bubbles: true }));
	});
	for (const btn of $$('[data-step]', box)) {
		btn.addEventListener('click', () => {
			const passo = Number(input.step) || 1;
			const min = input.min === '' ? -Infinity : Number(input.min);
			const max = input.max === '' ? Infinity : Number(input.max);
			const val = Number(input.value) || 0;
			input.value = String(Math.min(max, Math.max(min, val + Number(btn.dataset.step) * passo)));
			input.dispatchEvent(new Event('input', { bubbles: true }));
		});
	}
}

/* Visore foto, come Airbnb, su fondo bianco.
   "Tutte le foto": griglia a due colonne. Una foto alla volta: si scorre col dito, "3 di 17", frecce e tasti ← → col computer.
   La galleria in cima alle pagine apre la griglia (data-visore-apri="griglia"); le altre foto aprono subito quella toccata.
   Le foto con lo stesso data-visore-gruppo si sfogliano insieme. */
const visore = $('[data-visore]');
if (visore && typeof visore.showModal === 'function') {
	const vistaGriglia = $('[data-visore-vista="griglia"]', visore);
	const vistaFoto = $('[data-visore-vista="foto"]', visore);
	const griglia = $('[data-visore-griglia]', visore);
	const riga = $('[data-visore-riga]', visore);
	const conta = $('[data-visore-conta]', visore);
	const tutte = $('[data-visore-tutte]', visore);
	const prec = $('[data-visore-prec]', visore);
	const succ = $('[data-visore-succ]', visore);
	const lento = matchMedia('(prefers-reduced-motion: reduce)').matches;
	let gruppo = [];

	// una foto presa dal link: stessa immagine (e stesse misure) della miniatura, il link ha quella grande
	const immagine = (a, grande) => {
		const mini = $('img', a);
		const img = document.createElement('img');
		img.alt = mini?.alt || '';
		img.decoding = 'async';
		if (grande) {
			img.src = a.getAttribute('href');
			if (mini?.srcset) {
				img.srcset = mini.srcset;
				img.sizes = '100vw';
			}
		} else {
			img.src = mini?.currentSrc || mini?.src || a.getAttribute('href');
			img.loading = 'lazy';
		}
		if (mini?.width && mini?.height) {
			img.width = mini.width;
			img.height = mini.height;
		}
		return img;
	};
	const indice = () => Math.round(riga.scrollLeft / (riga.clientWidth || 1));
	const segna = () => {
		const i = Math.min(gruppo.length - 1, Math.max(0, indice()));
		conta.textContent = `${i + 1} di ${gruppo.length}`;
		prec.disabled = i <= 0;
		succ.disabled = i >= gruppo.length - 1;
	};
	const mostraFoto = (i, morbido = false) => {
		vistaGriglia.hidden = true;
		vistaFoto.hidden = false;
		// con una foto sola niente "Tutte le foto" né "1 di 1" (nascosti senza spostare la ×)
		tutte.style.visibility = conta.style.visibility = gruppo.length < 2 ? 'hidden' : '';
		requestAnimationFrame(() => {
			riga.scrollTo({ left: i * riga.clientWidth, behavior: morbido && !lento ? 'smooth' : 'auto' });
			segna();
		});
	};
	const mostraGriglia = () => {
		vistaFoto.hidden = true;
		vistaGriglia.hidden = false;
		vistaGriglia.scrollTop = 0;
	};
	const apri = (a) => {
		const nome = a.dataset.visoreGruppo;
		gruppo = nome ? $$(`[data-visore-gruppo="${nome}"]`) : [a];
		griglia.replaceChildren(
			...gruppo.map((x, i) => {
				const b = document.createElement('button');
				b.type = 'button';
				b.className = 'visore__mini';
				b.setAttribute('aria-label', `Apri la foto ${i + 1} di ${gruppo.length}`);
				b.append(immagine(x, false));
				b.addEventListener('click', () => mostraFoto(i));
				return b;
			})
		);
		riga.replaceChildren(
			...gruppo.map((x) => {
				const d = document.createElement('div');
				d.className = 'visore__pagina';
				d.append(immagine(x, true));
				return d;
			})
		);
		// riaperto mentre si stava chiudendo: vince l'ultima azione, la finestra resta aperta
		clearTimeout(visore._t);
		visore.classList.remove('is-chiude');
		if (!visore.open) visore.showModal();
		// il fuoco va sulla finestra, non sul primo pulsante: niente cerchio intorno alla × all'apertura
		visore.focus({ preventScroll: true });
		document.documentElement.classList.add('visore-aperto');
		if (a.dataset.visoreApri === 'griglia' && gruppo.length > 1) mostraGriglia();
		else mostraFoto(gruppo.indexOf(a));
	};
	for (const a of $$('[data-visore-link]')) {
		a.addEventListener('click', (e) => {
			e.preventDefault();
			apri(a);
		});
	}
	const vai = (verso) => mostraFoto(Math.min(gruppo.length - 1, Math.max(0, indice() + verso)), true);
	tutte.addEventListener('click', mostraGriglia);
	prec.addEventListener('click', () => vai(-1));
	succ.addEventListener('click', () => vai(1));
	riga.addEventListener('scroll', segna, { passive: true });
	addEventListener('resize', () => {
		if (visore.open && !vistaFoto.hidden) mostraFoto(indice());
	});
	visore.addEventListener('keydown', (e) => {
		if (vistaFoto.hidden || gruppo.length < 2) return;
		if (e.key === 'ArrowRight') vai(1);
		else if (e.key === 'ArrowLeft') vai(-1);
	});
	// chiudendo, la libreria scende piano e poi sparisce (anche con Esc)
	const chiudi = () => {
		if (!visore.open || visore.classList.contains('is-chiude')) return;
		const ms = durata('--t-esce', 250);
		if (lento || !ms) return visore.close();
		visore.classList.add('is-chiude');
		clearTimeout(visore._t);
		visore._t = setTimeout(() => {
			visore.close();
			visore.classList.remove('is-chiude');
		}, ms);
	};
	for (const b of $$('[data-visore-chiudi]', visore)) b.addEventListener('click', chiudi);
	visore.addEventListener('cancel', (e) => {
		e.preventDefault();
		chiudi();
	});
	visore.addEventListener('close', () => {
		document.documentElement.classList.remove('visore-aperto');
		riga.replaceChildren();
		griglia.replaceChildren();
	});
}

/* Pagina Lavori: pallini sotto ogni fila di foto, uno per ogni posizione in cui la fila si ferma */
for (const riga of $$('[data-punti-riga]')) {
	const box = riga.nextElementSibling?.matches('[data-punti]') ? riga.nextElementSibling : null;
	if (!box) continue;
	const lento = matchMedia('(prefers-reduced-motion: reduce)').matches;
	const passo = () => (riga.firstElementChild?.offsetWidth || riga.clientWidth) + (parseFloat(getComputedStyle(riga).columnGap) || 0);
	const max = () => riga.scrollWidth - riga.clientWidth;
	let punti = [];
	const disegna = () => {
		const n = max() > 2 ? Math.ceil(max() / passo() - 0.05) + 1 : 0;
		if (n === punti.length) return;
		punti = Array.from({ length: n }, (_, i) => {
			const b = document.createElement('button');
			b.type = 'button';
			b.className = 'v3-galleria__punto';
			b.tabIndex = -1;
			b.addEventListener('click', () => riga.scrollTo({ left: Math.min(max(), i * passo()), behavior: lento ? 'auto' : 'smooth' }));
			return b;
		});
		box.replaceChildren(...punti);
		segna();
	};
	const segna = () => {
		if (!punti.length) return;
		const i = riga.scrollLeft >= max() - 2 ? punti.length - 1 : Math.round(riga.scrollLeft / passo());
		punti.forEach((p, k) => p.classList.toggle('is-attivo', k === i));
	};
	riga.addEventListener('scroll', segna, { passive: true });
	if ('ResizeObserver' in window) new ResizeObserver(disegna).observe(riga);
	else addEventListener('resize', disegna);
	disegna();
}

/* Gallerie (in cima alle pagine, schede della home, tipi di ristrutturazione…): si scorrono col dito,
   "1 / 6" segue la foto (dove c'è), frecce ‹ › col mouse, pallini sotto */
for (const g of $$('[data-galleria]')) {
	const riga = $('[data-galleria-riga]', g);
	const n = $('[data-galleria-n]', g);
	const prec = $('[data-galleria-prec]', g);
	const succ = $('[data-galleria-succ]', g);
	const lento = matchMedia('(prefers-reduced-motion: reduce)').matches;
	const quale = () => Math.round(riga.scrollLeft / (riga.clientWidth || 1));
	// pallini sotto la galleria: quello acceso è la foto che stai guardando; toccandone uno si va a quella foto
	const punti = $$('[data-galleria-punto]', g.parentElement);
	// scritta che vale solo per la prima foto (L'azienda: «Immagine dimostrativa» sui furgoni, non sui lavori veri)
	const soloPrima = $('[data-galleria-solo-prima]', g);
	const stato = () => {
		const i = quale();
		if (n) n.textContent = String(i + 1);
		if (soloPrima) soloPrima.hidden = i > 0;
		if (prec) prec.disabled = i <= 0;
		if (succ) succ.disabled = i >= riga.children.length - 1;
		punti.forEach((p, k) => p.classList.toggle('is-attivo', k === i));
	};
	const vai = (verso) => riga.scrollTo({ left: (quale() + verso) * riga.clientWidth, behavior: lento ? 'auto' : 'smooth' });
	for (const p of punti)
		p.addEventListener('click', () =>
			riga.scrollTo({ left: Number(p.dataset.galleriaPunto) * riga.clientWidth, behavior: lento ? 'auto' : 'smooth' })
		);
	prec?.addEventListener('click', () => vai(-1));
	succ?.addEventListener('click', () => vai(1));
	riga.addEventListener('scroll', stato, { passive: true });
	stato();
}

/* Home: la foto di sfondo è alta quanto la prima schermata (titolo e ricerca);
   le icone dei lavori arrivano subito sotto, la freccia ↓ ci porta lì */
const sfondo = $('[data-sfondo]');
const zonaCerca = $('.v3-cerca');
if (sfondo && zonaCerca) {
	const fine = () => zonaCerca.offsetTop + zonaCerca.offsetHeight;
	const misura = () => (sfondo.style.height = `${fine()}px`);
	misura();
	addEventListener('resize', misura);
	document.addEventListener('sfondo-misura', misura);
	addEventListener('load', misura);
	$('[data-giu]')?.addEventListener('click', () => {
		window.amScopriTutto?.();
		// la vetrina parte subito sotto la testata, che intanto ha preso le sezioni dalla fascia
		const c = $('[data-contenuto]');
		const y = c ? c.getBoundingClientRect().top + scrollY - (header?.offsetHeight || 0) : fine();
		scrollTo({ top: Math.max(0, y), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
	});
}

/* Sezioni nella testata (in ogni pagina): la voce attiva si vede subito, anche quando la riga scorre di lato.
   Si centra solo se non si vede già intera (lo fa già lo script in fondo alla pagina, prima del primo disegno). */
const barraChips = $('[data-chips]');
const chipAttiva = barraChips && $('.mm-sezione.is-active', barraChips);
if (chipAttiva) {
	const riga = chipAttiva.parentElement;
	const fuori = chipAttiva.offsetLeft + chipAttiva.offsetWidth > riga.scrollLeft + riga.clientWidth - 8 || chipAttiva.offsetLeft < riga.scrollLeft;
	if (fuori) riga.scrollLeft = Math.max(0, chipAttiva.offsetLeft - riga.clientWidth / 2 + chipAttiva.offsetWidth / 2);
}

/* Freccia "indietro": torna alla pagina di prima del sito, altrimenti va alla home */
for (const a of $$('[data-indietro]')) {
	a.addEventListener('click', (e) => {
		let dalSito = false;
		try {
			dalSito = Boolean(document.referrer) && new URL(document.referrer).origin === location.origin;
		} catch {
			dalSito = false;
		}
		if (dalSito && history.length > 1) {
			e.preventDefault();
			history.back();
		}
	});
}

/* Mappe "Dove siamo": disegnate con MapLibre e la mappa libera di OpenFreeMap (nitida anche su iPhone).
   Il programma (nel sito, cartella vendor) si carica solo quando una mappa sta per vedersi. */
const mappe = $$('[data-mappa]');
if (mappe.length && 'IntersectionObserver' in window) {
	const base = new URL('../vendor/maplibre/', import.meta.url);
	let libreria;
	const carica = () =>
		(libreria ||= new Promise((ok, no) => {
			const css = document.createElement('link');
			css.rel = 'stylesheet';
			css.href = new URL('maplibre-gl.css', base).href;
			document.head.append(css);
			const s = document.createElement('script');
			s.src = new URL('maplibre-gl.js', base).href;
			s.onload = ok;
			s.onerror = no;
			document.head.append(s);
		}));
	const disegna = async (el) => {
		try {
			await carica();
			const mappa = new window.maplibregl.Map({
				container: el,
				style: 'https://tiles.openfreemap.org/styles/bright',
				center: [Number(el.dataset.lon), Number(el.dataset.lat)],
				zoom: Number(el.dataset.zoom) || (el.clientWidth < 600 ? 12.2 : 12.8),
				interactive: false,
				attributionControl: false,
				fadeDuration: 0
			});
			mappa.once('load', () => el.classList.add('is-pronta'));
		} catch {
			// senza mappa resta il fondo chiaro con il pallino: si può sempre toccare per aprire Mappe
		}
	};
	const guarda = new IntersectionObserver(
		(voci) => {
			for (const v of voci) {
				if (!v.isIntersecting) continue;
				guarda.unobserve(v.target);
				disegna(v.target);
			}
		},
		{ rootMargin: '300px' }
	);
	for (const m of mappe) guarda.observe(m);
}

/* "Portami qui": su iPhone, iPad e Mac apre Mappe di Apple, altrimenti Google Maps */
if (/iPhone|iPad|Macintosh/.test(navigator.userAgent)) {
	for (const a of $$('[data-portami]')) a.href = `https://maps.apple.com/?daddr=${encodeURIComponent(a.dataset.portami)}`;
}

/* Righe con frecce ‹ › (come Airbnb): scorrono di una pagina e si spengono agli estremi. Sul telefono si usa il dito. */
for (const box of $$('[data-scorri]')) {
	const riga = $('[data-scorri-riga]', box);
	const indietro = $('[data-scorri-prec]', box);
	const avanti = $('[data-scorri-succ]', box);
	if (!riga || !indietro || !avanti) continue;
	const lento = matchMedia('(prefers-reduced-motion: reduce)').matches;
	const stato = () => {
		indietro.disabled = riga.scrollLeft <= 2;
		avanti.disabled = riga.scrollLeft >= riga.scrollWidth - riga.clientWidth - 2;
	};
	const vai = (verso) => {
		const card = riga.firstElementChild;
		const spazio = parseFloat(getComputedStyle(riga).columnGap) || 0;
		const larga = card ? card.offsetWidth + spazio : riga.clientWidth;
		const quante = Math.max(1, Math.floor((riga.clientWidth + spazio) / larga));
		riga.scrollBy({ left: verso * larga * quante, behavior: lento ? 'auto' : 'smooth' });
	};
	indietro.addEventListener('click', () => vai(-1));
	avanti.addEventListener('click', () => vai(1));
	riga.addEventListener('scroll', stato, { passive: true });
	// anche quando la riga diventa visibile (schede della home) o cambia la finestra
	if ('ResizeObserver' in window) new ResizeObserver(stato).observe(riga);
	else addEventListener('resize', stato);
	stato();
}

/* Entrata morbida (12/10, lotto «Movimento rifinito»): solo le schede con foto salgono piano (12 px, 400 ms), la prima
   volta. Testi e prezzi si vedono subito. Arrivando con un'ancora (#…), col tasto indietro o con «Riduci movimento»
   niente entrate; con «Tutto» e con la freccia ↓ la destinazione si vede subito. La classe «entra» la mette questo
   script: se si ferma, il contenuto resta visibile. */
window.amScopriTutto = () => {};
if (
	'IntersectionObserver' in window &&
	!matchMedia('(prefers-reduced-motion: reduce)').matches &&
	!document.documentElement.classList.contains('torna') &&
	!location.hash
) {
	const vista = new IntersectionObserver(
		(voci) => {
			for (const v of voci) {
				if (!v.isIntersecting) continue;
				v.target.classList.add('si-vede');
				vista.unobserve(v.target);
				// a fine entrata si tolgono le classi: niente trasformazioni rimaste addosso
				setTimeout(() => v.target.classList.remove('entra', 'si-vede'), durata('--t-entra', 400) + 100);
			}
		},
		{ rootMargin: '0px 0px -6% 0px' }
	);
	const candidati = $$('.v3-card, .v3-mini, .v3-altri__card');
	for (const e of candidati) {
		if (e.getBoundingClientRect().top < innerHeight) continue;
		e.classList.add('entra');
		vista.observe(e);
	}
	window.amScopriTutto = () => {
		vista.disconnect();
		for (const e of $$('.entra')) e.classList.remove('entra', 'si-vede');
	};
}

/* Link alla stessa pagina (es. "Scrivici" → #scrivici): scorrimento morbido fatto qui, non dal CSS */
document.addEventListener('click', (e) => {
	const a = e.target.closest('a[href^="#"]');
	if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
	const id = decodeURIComponent(a.getAttribute('href').slice(1));
	const el = id && document.getElementById(id);
	if (!el) return;
	e.preventDefault();
	el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
});

{
	const campo = (el) => el?.matches?.('input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="hidden"]), textarea, select');
	let via;
	document.addEventListener('focusin', (e) => {
		if (!campo(e.target)) return;
		clearTimeout(via);
		document.documentElement.classList.add('tastiera');
	});
	document.addEventListener('focusout', (e) => {
		if (!campo(e.target)) return;
		via = setTimeout(() => {
			if (!campo(document.activeElement)) document.documentElement.classList.remove('tastiera');
		}, 120);
	});
}

/* Home: «Tutto» (nella testata e nella fascia sotto la foto) resta qui e scende alla vetrina; index.html#tutto ci arriva subito */
const contenuto = $('[data-contenuto]');
if (contenuto) {
	const ridotto = matchMedia('(prefers-reduced-motion: reduce)').matches;
	const scorriAllaVetrina = (morbido) => {
		window.amScopriTutto?.();
		const y = contenuto.getBoundingClientRect().top + scrollY - (header?.offsetHeight || 0);
		scrollTo({ top: Math.max(0, y), behavior: morbido && !ridotto ? 'smooth' : 'auto' });
	};
	const daIndirizzo = (primaVolta) => {
		if (decodeURIComponent(location.hash.slice(1)) === 'tutto' && !(primaVolta && tornato)) requestAnimationFrame(() => scorriAllaVetrina(!primaVolta));
	};
	daIndirizzo(true);
	addEventListener('hashchange', () => daIndirizzo(false));
	for (const tutto of $$('[data-chip="tutto"]'))
		tutto.addEventListener('click', (e) => {
			e.preventDefault();
			try {
				history.replaceState(null, '', location.pathname + '#tutto');
			} catch {
				// in alcune anteprime l'indirizzo non si può cambiare
			}
			scorriAllaVetrina(true);
		});
}

/* Modulo «Scrivici»: in questa versione è una PROVA. Controlla i campi e mostra la conferma, senza inviare niente
   e senza salvare niente. Si collegherà al server del nuovo progetto. */
for (const modulo of $$('[data-modulo-prova]')) {
	const errore = $('[data-modulo-errore]', modulo);
	modulo.addEventListener('submit', (e) => {
		e.preventDefault();
		const manca = $$('[required]', modulo).find((c) => (c.type === 'checkbox' ? !c.checked : !c.value.trim()) || !c.checkValidity());
		if (errore) {
			errore.hidden = !manca;
			errore.textContent = manca ? (manca.type === 'checkbox' ? 'Conferma di aver letto l’informativa privacy.' : manca.type === 'email' ? 'Scrivi un indirizzo email valido.' : 'Compila tutti i campi.') : '';
		}
		if (manca) return manca.focus();
		$('[data-conferma]', modulo).hidden = false;
		$('[type="submit"]', modulo).disabled = true;
	});
}

/* Scelte portate da una pagina all'altra (es. «Prenota» con mansarda e date): viaggiano nell'indirizzo
   (prenota.html#casa=il-nido&dal=…). Dove l'indirizzo non le lascia passare (alcune anteprime), le stesse scelte
   si ritrovano per pochi secondi nella memoria della visita: le legge static/js/sito.js (parametri). Niente dati personali. */
document.addEventListener('click', (e) => {
	const a = e.target.closest?.('a[href*="#"]');
	if (!a || e.defaultPrevented) return;
	const [pagina, coda] = (a.getAttribute('href') || '').split('#');
	if (!pagina || !coda || !coda.includes('=')) return;
	try {
		sessionStorage.setItem('lago-passaggio', JSON.stringify({ pagina: pagina.split('/').pop(), scelte: coda, quando: Date.now() }));
	} catch {
		// memoria non disponibile: restano le scelte nell'indirizzo
	}
});

/* Script delle singole parti: si caricano solo dove servono */
const carica = (file) => import(`./${file}?v=1`).catch((e) => console.error('[sito]', file, e));
if ($('[data-mini]')) carica('mini.js');
if ($('[data-prenota]')) carica('prenota.js');
if ($('[data-corsa]')) carica('corsa.js');
