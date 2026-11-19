import { environment } from '../../environments/environment';
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export type EstadoProspecto = 'nuevo' | 'contactado' | 'interesado' | 'negociacion' | 'descartado';
export type TipoCorreoProspecto = 'presentacion' | 'prueba_gratuita' | 'nueva_suscripcion' | 'personalizado' | 'anuncio';

export interface Prospecto {
  id: number;
  nombre: string;
  email: string;
  organizacion: string | null;
  cargo: string | null;
  telefono: string | null;
  origen: string | null;
  estado: EstadoProspecto;
  notas: string | null;
  no_contactar: boolean;
  correos_enviados: number;
  ultimo_correo_tipo: string | null;
  ultimo_correo_fecha: string | null;
  ultimo_gmail_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProspectoFormulario {
  nombre: string;
  email: string;
  organizacion: string;
  cargo: string;
  telefono: string;
  origen: string;
  estado: EstadoProspecto;
  notas: string;
  no_contactar: boolean;
}

export interface ProspectosRespuesta {
  ok: boolean;
  total: number;
  pagina: number;
  limite: number;
  prospectos: Prospecto[];
}

export interface CrudProspectoRespuesta {
  ok: boolean;
  message: string;
  id?: number;
}

export interface CorreoProspectoRespuesta {
  ok: boolean;
  message: string;
  destinatario: string;
  gmail_message_id?: string;
  seguimiento_guardado: boolean;
}

@Injectable({ providedIn: 'root' })
export class ProspectosService {
  private readonly baseUrl = `${environment.apiUrl}/admin/prospectos`;

  constructor(private http: HttpClient) {}

  listar(buscar: string, estado: string, pagina: number, limite = 25): Observable<ProspectosRespuesta> {
    let params = new HttpParams().set('pagina', pagina).set('limite', limite);
    if (buscar.trim()) params = params.set('buscar', buscar.trim());
    if (estado) params = params.set('estado', estado);
    return this.http.get<ProspectosRespuesta>(
      this.baseUrl, { params }
    );
  }

  crear(body: ProspectoFormulario): Observable<CrudProspectoRespuesta> {
    return this.http.post<CrudProspectoRespuesta>(
      this.baseUrl, body
    );
  }

  editar(id: number, body: ProspectoFormulario): Observable<CrudProspectoRespuesta> {
    return this.http.patch<CrudProspectoRespuesta>(
      `${this.baseUrl}/${id}`, body
    );
  }

  enviarCorreo(id: number, body: {
    tipo: TipoCorreoProspecto;
    asunto?: string;
    mensaje?: string;
  }): Observable<CorreoProspectoRespuesta> {
    return this.http.post<CorreoProspectoRespuesta>(
      `${this.baseUrl}/${id}/enviar-correo`, body
    );
  }
}
