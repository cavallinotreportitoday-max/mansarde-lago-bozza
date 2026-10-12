// Calendario unico del sito. Finestra, stile e movimenti sono quelli della base grafica ([data-cal], classi .cal);
// la logica è nuova:
// - modo «intervallo» (soggiorno, andata e ritorno): primo tocco = inizio, secondo tocco = fine, nella stessa vista;
//   i giorni non disponibili sono spenti; dopo l'inizio restano accesi solo i giorni di fine possibili
// - modo «giorno» (una corsa): un tocco sceglie il giorno
// Le scelte restano in una bozza: chiudere (×, Esc, clic fuori) non cambia niente; solo «Salva» le conferma.
// Giorni civili sul calendario di Roma (Europe/Rome).
import { durata, daTastiera } from './tendine.js?v=eefd22c5';
import { chiave, daChiave, piu, oggiRoma, notti } from './prezzi.js?v=eefd22c5';
import { lungo, corto } from './sito.js?v=eefd22c5';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const cal = $('[data-cal]');
let chiudiAttuale = null;

/**
 * Apre il calendario e ritorna una promessa: { da, a } (chiavi AAAA-MM-GG; in modo «giorno» solo da) oppure null se chiuso senza salvare.
 * o: {
 *   modo: 'intervallo' | 'giorno', da, a: valori di partenza, parti: 'da' | 'a',
 *   min, max: Date, libero(k): il giorno si può scegliere come inizio (o come giorno),
 *   fineOk(da, a): la fine va bene per quell'inizio (di serie: almeno nottiMin, al massimo nottiMax, inizi liberi in mezzo),
 *   nottiMin, nottiMax, testi: { inizio, fine, fatto, sotto, primo, secondo, unita(n), salva, niente }, daChi: pulsante che l'ha aperto
 * }
 */
export function apriCalendario(o) {
	if (!cal || typeof cal.showModal !== 'function') return Promise.resolve(null);
	chiudiAttuale?.(null);
	const mesiBox = $('[data-cal-mesi]', cal);
	const titolo = $('[data-cal-titolo]', cal);
	const sotto = $('[data-cal-sotto]', cal);
	const passoTesto = $('[data-cal-passo]', cal);
	const sceltaTesto = $('[data-cal-scelta]', cal);
	const cancella = $('[data-cal-cancella]', cal);
	const salva = $('[data-cal-salva]', cal);
	const chiudiTasto = $('[data-cal-chiudi]', cal);

	const intervallo = o.modo !== 'giorno';
	const nottiMin = o.nottiMin ?? 1;
	const nottiMax = o.nottiMax ?? 28;
	const t = { inizio: 'Quando arrivi?', fine: 'Quando riparti?', fatto: 'Le tue date', sotto: 'I giorni barrati non sono disponibili.', primo: 'Arrivo', secondo: 'Partenza', unita: (n) => `${n} ${n === 1 ? 'notte' : 'notti'}`, salva: 'Salva le date', niente: 'Nessuna data scelta', ...(o.testi || {}) };
	const libero = (d) => d >= o.min && d <= o.max && (o.libero ? o.libero(chiave(d)) : true);
	const fineOk =
		o.fineOk ||
		((da, a) => {
			const n = notti(da, a);
			if (n < nottiMin || n > nottiMax) return false;
			for (let i = 0; i < n; i++) if (o.libero && !o.libero(chiave(piu(daChiave(da), i)))) return false;
			return true;
		});

	// bozza di questa apertura
	let da = daChiave(o.da);
	let a = intervallo ? daChiave(o.a) : null;
	if (da && !libero(da)) da = a = null;
	if (intervallo && da && a && !fineOk(chiave(da), chiave(a))) a = null;
	if (intervallo && o.parti === 'a' && da) a = null; // aperto dalla casella «Partenza»: si sceglie la fine

	return new Promise((risolvi) => {
		let finito = false;
		const fase = () => (intervallo && da && !a ? 'fine' : 'inizio');
		const completo = () => (intervallo ? Boolean(da && a) : Boolean(da));

		const stato = () => {
			const f = fase();
			const kda = da ? chiave(da) : '';
			const ka = a ? chiave(a) : '';
			for (const b of $$('.cal__giorno', mesiBox)) {
				const k = b.dataset.giorno;
				const d = daChiave(k);
				let ok;
				if (f === 'fine') ok = d > da || (nottiMin === 0 && k === kda) ? d <= piu(o.max, nottiMax) && fineOk(kda, k) : libero(d);
				else ok = libero(d);
				// in modo intervallo la fine già scelta resta accesa anche se come inizio non sarebbe libera
				if (k === ka) ok = true;
				b.disabled = !ok;
				const scelto = k === kda || k === ka;
				b.classList.toggle('is-scelto', scelto);
				b.classList.toggle('is-mezzo', Boolean(kda && ka && k > kda && k < ka));
				b.setAttribute('aria-pressed', String(scelto));
				b.setAttribute('aria-label', lungo(k) + (ok ? '' : ', non disponibile') + (k === kda && intervallo ? `, ${t.primo.toLowerCase()}` : '') + (k === ka ? `, ${t.secondo.toLowerCase()}` : ''));
			}
			if (intervallo) {
				passoTesto.textContent = completo() ? '' : f === 'fine' ? 'Passo 2 di 2' : 'Passo 1 di 2';
				titolo.textContent = completo() ? t.fatto : f === 'fine' ? t.fine : t.inizio;
				sceltaTesto.textContent = completo() ? `${corto(da)} – ${corto(a)} · ${t.unita(notti(kda, ka))}` : da ? `${t.primo}: ${lungo(da)}` : t.niente;
			} else {
				passoTesto.textContent = '';
				titolo.textContent = t.inizio;
				sceltaTesto.textContent = da ? lungo(da) : t.niente;
			}
			sotto.textContent = t.sotto;
			cancella.hidden = !da;
			salva.disabled = !completo();
			salva.textContent = t.salva;
		};

		const disegna = () => {
			const oggi = oggiRoma();
			const ultimo = intervallo ? piu(o.max, 0) : o.max;
			const mesi = (ultimo.getFullYear() - oggi.getFullYear()) * 12 + ultimo.getMonth() - oggi.getMonth() + 1;
			const frag = document.createDocumentFragment();
			for (let m = 0; m < mesi; m++) {
				const primo = new Date(oggi.getFullYear(), oggi.getMonth() + m, 1);
				const sez = document.createElement('section');
				sez.className = 'cal__mese';
				const nome = document.createElement('h3');
				nome.className = 'cal__nome';
				const testo = primo.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
				nome.textContent = testo.charAt(0).toUpperCase() + testo.slice(1);
				const griglia = document.createElement('div');
				griglia.className = 'cal__griglia';
				for (let i = 0; i < (primo.getDay() + 6) % 7; i++) griglia.append(document.createElement('span'));
				const fine = new Date(primo.getFullYear(), primo.getMonth() + 1, 0).getDate();
				for (let g = 1; g <= fine; g++) {
					const b = document.createElement('button');
					b.type = 'button';
					b.className = 'cal__giorno';
					b.textContent = g;
					b.dataset.giorno = chiave(new Date(primo.getFullYear(), primo.getMonth(), g));
					griglia.append(b);
				}
				sez.append(nome, griglia);
				frag.append(sez);
			}
			mesiBox.replaceChildren(frag);
		};

		const tocca = (e) => {
			const b = e.target.closest('.cal__giorno');
			if (!b || b.disabled) return;
			const d = daChiave(b.dataset.giorno);
			if (!intervallo) da = da && chiave(da) === b.dataset.giorno ? null : d;
			else if (!da || a) (da = d), (a = null);
			else if (d > da || (nottiMin === 0 && chiave(d) === chiave(da))) a = d;
			else da = d;
			stato();
		};
		const svuota = () => {
			da = a = null;
			stato();
			($('.cal__giorno:not(:disabled)', mesiBox) || salva).focus({ preventScroll: true });
		};
		const conferma = () => chiudi(intervallo ? { da: chiave(da), a: chiave(a) } : { da: chiave(da) });
		const annulla = () => chiudi(null);
		const fuori = (e) => {
			if (e.target === cal) chiudi(null); // clic fuori: chiude senza salvare
		};
		const esc = (e) => {
			e.preventDefault();
			chiudi(null);
		};

		// chiusura con un movimento: sul telefono scende come le tendine, sul computer sparisce svelto
		function chiudi(esito) {
			if (finito) return;
			finito = true;
			chiudiAttuale = null;
			mesiBox.removeEventListener('click', tocca);
			cancella.removeEventListener('click', svuota);
			salva.removeEventListener('click', conferma);
			chiudiTasto.removeEventListener('click', annulla);
			cal.removeEventListener('click', fuori);
			cal.removeEventListener('cancel', esc);
			const fine = () => {
				cal.classList.remove('is-chiude');
				if (cal.open) cal.close();
				document.documentElement.classList.remove('cal-aperto');
				// il fuoco torna al pulsante che l'ha aperto; col dito il browser lo rimette da solo, senza riquadro
				if (daTastiera() || !matchMedia('(hover: none)').matches) o.daChi?.focus({ preventScroll: true });
				risolvi(esito);
			};
			const ms = durata(matchMedia('(max-width: 860px)').matches ? '--t-chiudi' : '--t-rapido', 200);
			if (!ms || !cal.open) return fine();
			cal.classList.add('is-chiude');
			cal._t = setTimeout(fine, ms);
		}
		chiudiAttuale = chiudi;

		mesiBox.addEventListener('click', tocca);
		cancella.addEventListener('click', svuota);
		salva.addEventListener('click', conferma);
		chiudiTasto.addEventListener('click', annulla);
		cal.addEventListener('click', fuori);
		cal.addEventListener('cancel', esc);

		clearTimeout(cal._t);
		cal.classList.remove('is-chiude');
		disegna();
		stato();
		if (!cal.open) cal.showModal(); // la pagina sotto resta inerte finché la finestra è aperta
		document.documentElement.classList.add('cal-aperto');
		const vedi = $('.cal__giorno.is-scelto', mesiBox) || $('.cal__giorno:not(:disabled)', mesiBox);
		mesiBox.scrollTop = vedi ? Math.max(0, vedi.closest('.cal__mese').offsetTop - mesiBox.offsetTop) : 0;
		(vedi || salva).focus({ preventScroll: true });
	});
}
