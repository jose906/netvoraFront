import { Component, OnInit } from '@angular/core';
import {
  Prospecto, ProspectoFormulario, ProspectosService,
  EstadoProspecto, TipoCorreoProspecto
} from '../services/prospectos.service';

function nuevoFormulario(): ProspectoFormulario {
  return {
    nombre: '', email: '', organizacion: '', cargo: '', telefono: '',
    origen: '', estado: 'nuevo', notas: '', no_contactar: false
  };
}

@Component({
  selector: 'app-prospectos',
  templateUrl: './prospectos.component.html',
  styleUrls: ['./prospectos.component.css']
})
export class ProspectosComponent implements OnInit {
  prospectos: Prospecto[] = [];
  total = 0;
  pagina = 1;
  readonly limite = 25;
  buscar = '';
  filtroEstado = '';
  cargando = false;
  guardando = false;
  enviando = false;
  errorLista = '';
  aviso = '';
  avisoError = false;

  formularioAbierto = false;
  editandoId: number | null = null;
  form: ProspectoFormulario = nuevoFormulario();

  destinatarioCorreo: Prospecto | null = null;
  tipoCorreo: TipoCorreoProspecto = 'presentacion';
  asuntoCorreo = '';
  mensajeCorreo = '';

  readonly estados: { value: EstadoProspecto; label: string }[] = [
    { value: 'nuevo', label: 'Nuevo' },
    { value: 'contactado', label: 'Contactado' },
    { value: 'interesado', label: 'Interesado' },
    { value: 'negociacion', label: 'En negociación' },
    { value: 'descartado', label: 'Descartado' }
  ];

  readonly tiposCorreo: {value: TipoCorreoProspecto; label: string}[] = [
    { value: 'presentacion', label: 'Presentación de NetVora' },
    { value: 'prueba_gratuita', label: 'Invitación a prueba gratuita' },
    { value: 'nueva_suscripcion', label: 'Conocer planes de suscripción' },
    { value: 'personalizado', label: 'Mensaje personalizado' },
    { value: 'anuncio', label: 'Anuncio' }
  ];

  constructor(private prospectosService: ProspectosService) {}

  ngOnInit(): void { this.cargar(); }

  get totalPaginas(): number { return Math.max(1, Math.ceil(this.total / this.limite)); }

  get correoPersonalizado(): boolean {
    return this.tipoCorreo === 'personalizado' || this.tipoCorreo === 'anuncio';
  }

  cargar(): void {
    this.cargando = true;
    this.errorLista = '';
    this.prospectosService.listar(this.buscar, this.filtroEstado, this.pagina, this.limite).subscribe({
      next: r => {
        this.prospectos = r.prospectos || [];
        this.total = r.total || 0;
        this.cargando = false;
      },
      error: err => {
        this.errorLista = err?.error?.error || 'No se pudieron cargar los prospectos.';
        this.cargando = false;
      }
    });
  }

  filtrar(): void { this.pagina = 1; this.cargar(); }

  irPagina(cambio: number): void {
    const siguiente = this.pagina + cambio;
    if (siguiente < 1 || siguiente > this.totalPaginas) return;
    this.pagina = siguiente;
    this.cargar();
  }

  nuevo(): void {
    this.form = nuevoFormulario();
    this.editandoId = null;
    this.formularioAbierto = true;
    this.aviso = '';
  }

  editar(p: Prospecto): void {
    this.form = {
      nombre: p.nombre, email: p.email,
      organizacion: p.organizacion || '', cargo: p.cargo || '',
      telefono: p.telefono || '', origen: p.origen || '',
      estado: p.estado, notas: p.notas || '', no_contactar: p.no_contactar
    };
    this.editandoId = p.id;
    this.formularioAbierto = true;
    this.aviso = '';
  }

  cancelarEdicion(): void {
    this.formularioAbierto = false;
    this.editandoId = null;
    this.form = nuevoFormulario();
  }

  guardar(): void {
    if (this.guardando) return;
    if (!this.form.nombre.trim() || !this.form.email.trim()) {
      this.mostrarAviso('El nombre y el correo son obligatorios.', true);
      return;
    }
    this.guardando = true;
    const solicitud = this.editandoId === null
      ? this.prospectosService.crear(this.form)
      : this.prospectosService.editar(this.editandoId, this.form);
    solicitud.subscribe({
      next: () => {
        this.guardando = false;
        this.cancelarEdicion();
        this.mostrarAviso('Datos del prospecto guardados correctamente.');
        this.pagina = 1;
        this.cargar();
      },
      error: err => {
        this.guardando = false;
        this.mostrarAviso(err?.error?.error || 'No se pudo guardar el prospecto.', true);
      }
    });
  }

  abrirCorreo(p: Prospecto): void {
    if (p.no_contactar) {
      this.mostrarAviso('Este contacto está marcado como «No contactar».', true);
      return;
    }
    this.destinatarioCorreo = p;
    this.tipoCorreo = 'presentacion';
    this.asuntoCorreo = '';
    this.mensajeCorreo = '';
    this.aviso = '';
  }

  cerrarCorreo(): void { if (!this.enviando) this.destinatarioCorreo = null; }

  enviarCorreo(): void {
    const p = this.destinatarioCorreo;
    if (!p || this.enviando) return;
    if (this.correoPersonalizado && (!this.asuntoCorreo.trim() || !this.mensajeCorreo.trim())) {
      this.mostrarAviso('Completá el asunto y el mensaje.', true);
      return;
    }
    if (!confirm(`¿Enviar este correo desde ventas@netvora.org a ${p.email}?`)) return;

    this.enviando = true;
    this.prospectosService.enviarCorreo(p.id, {
      tipo: this.tipoCorreo,
      asunto: this.asuntoCorreo,
      mensaje: this.mensajeCorreo
    }).subscribe({
      next: respuesta => {
        this.enviando = false;
        this.destinatarioCorreo = null;
        this.mostrarAviso(
          respuesta.seguimiento_guardado
            ? `Gmail API aceptó el correo para ${respuesta.destinatario}.`
            : `Correo aceptado por Gmail API, pero no se pudo guardar el seguimiento. Revisá los logs.`
        );
        this.cargar();
      },
      error: err => {
        this.enviando = false;
        this.mostrarAviso(err?.error?.error || 'No se pudo enviar el correo.', true);
      }
    });
  }

  mostrarAviso(texto: string, error = false): void {
    this.aviso = texto;
    this.avisoError = error;
  }

  estadoEtiqueta(estado: string): string {
    return this.estados.find(x => x.value === estado)?.label || estado;
  }

  formatoFecha(fecha: string | null): string {
    if (!fecha) return '—';
    const d = new Date(fecha);
    if (Number.isNaN(d.getTime())) return fecha;
    return new Intl.DateTimeFormat('es-BO', {
      timeZone: 'America/La_Paz', day: '2-digit', month: '2-digit',
      year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
    }).format(d);
  }
}
