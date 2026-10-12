// PAGAMENTO.
//
// OGGI (versione dimostrativa): MODO = 'demo'. Si apre una finestra del sito che dice chiaramente che è una prova:
// non chiede dati di carte, non carica niente da Stripe, non fa nessuna richiesta in rete, non salva niente.
//
// DOMANI (nuovo progetto, vedi LEGGIMI.md → «Collegare prenotazioni e pagamenti»):
// 1. il sito manda la richiesta di prenotazione al server del NUOVO progetto (mai a quello di altri siti);
// 2. il server rifà il conto con lo stesso motore (src/lib/prezzi.js), controlla che le date siano libere,
//    le blocca per qualche minuto e crea una sessione di Stripe Checkout con la chiave SEGRETA (che sta solo sul server);
// 3. il sito porta il cliente alla pagina di pagamento di Stripe (indirizzo ricevuto dal server);
// 4. Stripe avvisa il server (webhook) che il pagamento è riuscito: solo allora la prenotazione è confermata.
// Il prezzo scritto nella pagina non è mai quello che fa fede: decide il server.
// Qui servirà soltanto sostituire il ramo 'demo' di paga() con la chiamata al server: il resto del sito non cambia.
import { durata, daTastiera } from './tendine.js?v=2';
import { euro } from './prezzi.js?v=2';

export const MODO = 'demo';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

/**
 * Chiede il pagamento. ordine: { importo, descrizione }.
 * Ritorna 'pagato', 'rifiutato' oppure 'annullato' (finestra chiusa).
 */
export function paga(ordine, daChi = null) {
	if (MODO !== 'demo') return Promise.reject(new Error('Pagamenti veri non ancora collegati: vedi static/js/pagamento.js'));
	const fin = $('[data-paga]');
	if (!fin || typeof fin.showModal !== 'function') return Promise.resolve('annullato');
	$('[data-paga-importo]', fin).textContent = `${euro(ordine.importo)} · ${ordine.descrizione}`;
	return new Promise((risolvi) => {
		let finito = false;
		const chiudi = (esito) => {
			if (finito) return;
			finito = true;
			for (const b of $$('[data-paga-esito]', fin)) b.removeEventListener('click', scelta);
			$('[data-paga-chiudi]', fin).removeEventListener('click', annulla);
			fin.removeEventListener('cancel', esc);
			fin.removeEventListener('click', fuori);
			const fine = () => {
				fin.classList.remove('is-chiude');
				if (fin.open) fin.close();
				if (esito !== 'pagato' && (daTastiera() || !matchMedia('(hover: none)').matches)) daChi?.focus({ preventScroll: true });
				risolvi(esito);
			};
			const ms = durata('--t-rapido', 150);
			if (!ms) return fine();
			fin.classList.add('is-chiude');
			setTimeout(fine, ms);
		};
		const scelta = (e) => chiudi(e.currentTarget.dataset.pagaEsito);
		const annulla = () => chiudi('annullato');
		const esc = (e) => {
			e.preventDefault();
			chiudi('annullato');
		};
		const fuori = (e) => {
			if (e.target === fin) chiudi('annullato');
		};
		for (const b of $$('[data-paga-esito]', fin)) b.addEventListener('click', scelta);
		$('[data-paga-chiudi]', fin).addEventListener('click', annulla);
		fin.addEventListener('cancel', esc);
		fin.addEventListener('click', fuori);
		fin.classList.remove('is-chiude');
		if (!fin.open) fin.showModal();
		$('[data-paga-esito="pagato"]', fin).focus({ preventScroll: true });
	});
}
