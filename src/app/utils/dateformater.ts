export class Dateformater {


    constructor(){}

    formatearFechaAyyyymmdd(fecha: Date): string {
        const año = fecha.getFullYear();
        const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
        const dia = fecha.getDate().toString().padStart(2, '0');
        return `${año}${mes}${dia}`;
      }
}
