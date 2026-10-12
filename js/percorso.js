// Parti in comune ai due percorsi di prenotazione (soggiorno e corsa con autista):
// - i passi: uno aperto alla volta, numero, riga di riassunto e «Modifica» su quelli fatti
// - il conto di lato, voce per voce
// - il controllo dei dati di chi prenota
// - la schermata finale della prova
// Nessuna richiesta in rete: in questa versione tutto resta nella pagina.
import { euro, codiceProva } from './prezzi.js?v=1';
import { ravviva } from './tendine.js?v=1';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const ridotto = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Avvia i passi dentro box.
 * o: { valida(id) → '' oppure il messaggio d'errore, sintesi(id) → riga di riassunto, alFine(pulsante), alApri(id) }
 */
export function avviaPassi(box, o) {
	const tutti = $$('[data-passo]', box);
	const fatti = new Set();
	const visibili = () => tutti.filter((p) => !p.hidden);
	const id = (p) => p.dataset.passo;
	const header = document.querySelector('[data-header]');

	const numera = () => visibili().forEach((p, i) => ($('[data-passo-n]', p).textContent = String(i + 1)));
	const errore = (p, testo = '') => {
		const e = $('[data-passo-errore]', p);
		e.textContent = testo;
		e.hidden = !testo;
	};
	const riassumi = () => {
		for (const p of tutti) {
			const fatto = fatti.has(id(p));
			p.classList.toggle('is-fatto', fatto);
			$('[data-passo-sintesi]', p).textContent = fatto ? o.sintesi?.(id(p)) || '' : '';
		}
	};
	const aperto = () => visibili().find((p) => p.classList.contains('is-aperto')) || null;
	const apri = (p, scorri = true) => {
		for (const q of tutti) {
			const si = q === p;
			q.classList.toggle('is-aperto', si);
			$('[data-passo-corpo]', q).hidden = !si;
			$('[data-passo-apri]', q).setAttribute('aria-expanded', String(si));
		}
		riassumi();
		o.alApri?.(id(p));
		if (!scorri) return;
		// il passo aperto si vede intero dall'inizio, sotto la testata
		requestAnimationFrame(() => {
			const y = p.getBoundingClientRect().top + scrollY - (header?.offsetHeight || 0) - 16;
			if (Math.abs(y - scrollY) > 40) scrollTo({ top: Math.max(0, y), behavior: ridotto() ? 'auto' : 'smooth' });
		});
	};
	// si può aprire un passo solo se quelli prima sono fatti
	const raggiungibile = (p) => visibili().slice(0, visibili().indexOf(p)).every((q) => fatti.has(id(q)));
	/** Controlla tutti i passi in ordine: apre il primo che non va e ritorna false */
	const tuttoOk = () => {
		for (const p of visibili()) {
			const msg = o.valida(id(p));
			if (msg) {
				fatti.delete(id(p));
				apri(p);
				errore(p, msg);
				return false;
			}
			fatti.add(id(p));
		}
		riassumi();
		return true;
	};
	const avanti = (p, pulsante) => {
		const msg = o.valida(id(p));
		errore(p, msg);
		if (msg) {
			$('[data-passo-errore]', p).scrollIntoView({ block: 'nearest', behavior: ridotto() ? 'auto' : 'smooth' });
			return;
		}
		fatti.add(id(p));
		const v = visibili();
		const dopo = v.slice(v.indexOf(p) + 1).find((q) => !fatti.has(id(q))) || v.find((q) => !fatti.has(id(q)));
		if (dopo) return apri(dopo);
		riassumi();
		if (tuttoOk()) o.alFine?.(pulsante);
	};

	for (const p of tutti) {
		$('[data-passo-apri]', p).addEventListener('click', () => {
			if (p.classList.contains('is-aperto') || !raggiungibile(p)) return;
			apri(p);
		});
		$('[data-passo-avanti]', p).addEventListener('click', (e) => avanti(p, e.currentTarget));
		// scrivendo, l'errore del passo sparisce
		p.addEventListener('input', () => errore(p, ''));
	}
	numera();
	riassumi();
	return {
		/** Mostra o nasconde un passo (es. il transfer quando l'autista non è attivo) */
		mostra(nome, si) {
			const p = tutti.find((q) => id(q) === nome);
			if (p) p.hidden = !si;
			numera();
		},
		/** Un passo già fatto torna da fare (es. cambiato il servizio: il percorso va riscelto) */
		rifai(...nomi) {
			for (const n of nomi) fatti.delete(n);
			riassumi();
		},
		segnaErrore(nome, testo) {
			const p = tutti.find((q) => id(q) === nome);
			if (!p) return;
			apri(p);
			errore(p, testo);
		},
		riassumi,
		aperto: () => (aperto() ? id(aperto()) : ''),
		/** Fa «Avanti» sul passo aperto (barra in fondo del telefono) */
		continua() {
			const p = aperto() || visibili().find((q) => !fatti.has(id(q)));
			if (p) $('[data-passo-avanti]', p).click();
		}
	};
}

/** Scrive il conto di lato: righe [{ voce, dettaglio, importo }] e totale */
export function scriviConto(box, conto) {
	const righe = $('[data-riep-righe]', box);
	const totale = $('[data-riep-totale]', box);
	const vuoto = $('[data-riep-vuoto]', box);
	const ok = Boolean(conto?.ok);
	vuoto.hidden = ok;
	totale.hidden = !ok;
	righe.replaceChildren();
	if (!ok) {
		if (conto?.errore) vuoto.textContent = conto.errore;
		return;
	}
	for (const r of conto.righe) {
		const dt = document.createElement('dt');
		dt.textContent = r.voce;
		if (r.dettaglio) dt.append(Object.assign(document.createElement('small'), { textContent: r.dettaglio }));
		const dd = document.createElement('dd');
		dd.textContent = euro(r.importo);
		if (r.importo < 0) dd.className = 'is-sconto';
		righe.append(dt, dd);
	}
	const cifra = $('[data-riep-cifra]', box);
	const nuovo = euro(conto.totale);
	if (cifra.textContent !== nuovo) {
		cifra.textContent = nuovo;
		ravviva(cifra);
	}
}

/** Controlla nome, telefono, email e la spunta delle condizioni. Ritorna '' oppure il messaggio */
export function controllaDati(dove) {
	const v = (n) => ($(`[name="${n}"]`, dove)?.value || '').trim();
	if (v('nome').length < 3) return 'Scrivi nome e cognome.';
	if (v('telefono').replace(/[^\d]/g, '').length < 6) return 'Scrivi un numero di telefono a cui possiamo trovarti.';
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v('email'))) return 'Scrivi un indirizzo email valido: lì arriva la conferma.';
	if (!$('[name="privacy"]', dove)?.checked) return 'Conferma di aver letto condizioni e informativa privacy.';
	return '';
}

const SPUNTA =
	'<svg class="icon" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" vector-effect="non-scaling-stroke"/></svg>';

/**
 * Schermata finale della PROVA: prende il posto di passi e conto.
 * o: { box, titolo, righe: [[etichetta, valore]], pagato, home }
 */
export function mostraFatto(o) {
	const fatto = $('[data-fatto]', o.box);
	const codice = codiceProva();
	const el = (tag, cls, testo) => Object.assign(document.createElement(tag), { className: cls || '', textContent: testo || '' });
	const icona = el('span', 'pn-fatto__icona');
	icona.innerHTML = SPUNTA;
	const dl = el('dl', 'pn-fatto__righe');
	for (const [k, v] of [['Codice di prova', codice], ...o.righe, ['Pagato ora (simulato)', euro(o.pagato)]]) {
		if (!v) continue;
		dl.append(el('dt', '', k), el('dd', '', v));
	}
	const nota = el('p', 'pn-fatto__nota', 'È una dimostrazione: non è stata registrata nessuna prenotazione, non è partito nessun pagamento e i tuoi dati non sono stati inviati né salvati.');
	const comandi = el('div', 'pn-fatto__comandi');
	const casa = Object.assign(el('a', 'v3-btn', 'Torna alla home'), { href: o.home || './index.html' });
	const ancora = Object.assign(el('button', 'v3-btn v3-btn--linea', 'Fai un’altra prova'), { type: 'button' });
	ancora.addEventListener('click', () => {
		location.hash = '';
		location.reload();
	});
	comandi.append(casa, ancora);
	fatto.replaceChildren(icona, el('h2', 'pn-fatto__titolo', o.titolo), el('p', 'pn-fatto__sotto', 'Nel sito vero a questo punto arriva l’email di conferma.'), dl, nota, comandi);
	for (const x of $$('[data-passi], [data-riepilogo]', o.box)) x.hidden = true;
	for (const x of $$('[data-pn-fondo]')) x.hidden = true;
	o.box.classList.add('is-fatto');
	fatto.hidden = false;
	scrollTo({ top: 0, behavior: 'auto' });
	fatto.focus({ preventScroll: true });
}
