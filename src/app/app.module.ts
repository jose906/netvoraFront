import { NgModule } from '@angular/core';
import { BrowserModule, provideClientHydration } from '@angular/platform-browser';
import { RouterModule,Routes} from '@angular/router';
import { HttpClient, HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { MenuComponent } from './menu/menu.component';
import { PoliticaComponent } from './politica/politica.component';
import { ResumenComponent } from './resumen/resumen.component';
import { EconomiaComponent } from './economia/economia.component';
import { SeguridadComponent } from './seguridad/seguridad.component';
import { EstadisticasComponent } from './estadisticas/estadisticas.component';
import { MatDatepickerModule } from '@angular/material/datepicker'
import { MatInputModule } from '@angular/material/input'
import { MatNativeDateModule } from '@angular/material/core'
import { FormsModule } from '@angular/forms' 
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'
import { MatFormFieldModule} from '@angular/material/form-field';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { DeportesComponent } from './deportes/deportes.component';
import { SocialComponent } from './social/social.component'
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { TodosComponent } from './data/todos/todos.component';
import { PoliticaEstadisticasComponent } from './data/politica-estadisticas/politica-estadisticas.component';
import {NgChartsModule} from 'ng2-charts'
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';


import { PrincipalComponent } from './principal/principal.component';
import { AdministradorComponent } from './administrador/administrador.component';
import { PersonasComponent } from './personas/personas.component';
import { GestionesComponent } from './gestiones/gestiones.component';
import { SaludComponent } from './salud/salud.component';
import path from 'path';
import { LoginComponent } from './login/login.component';
import { EducacionComponent } from './educacion/educacion.component';
import { OtrosComponent } from './otros/otros.component';
import { environment } from '../environments/environment';
import { AngularFireModule } from '@angular/fire/compat';
import { AngularFireAuthModule } from '@angular/fire/compat/auth';
import { getAuth,provideAuth } from '@angular/fire/auth';
import { AuthInterceptor } from "./core/interceptor/auth.interceptor";
import { AuthGuard } from './core/guards/auth.guard';
import { provideFirebaseApp } from '@angular/fire/app';
import { EntidadesComponent } from './entidades/entidades.component';
import { CatSelectComponent } from './cat-select/cat-select.component';
import { RoleGuard } from './core/guards/role.guard';
import { EstadisticasEntiPersonasComponent } from './data/estadisticas-enti-personas/estadisticas-enti-personas.component';
import { MatTooltipModule } from '@angular/material/tooltip';

// Initialize Firebase


const routes: Routes = [
  { path: '', component: PrincipalComponent, canActivate: [AuthGuard] },
  { path: 'politica', component: PoliticaComponent },
  { path: 'economia', component: EconomiaComponent },
  { path: 'resumen',  component: ResumenComponent},
  { path: 'seguridad',  component: SeguridadComponent },
  { path: 'estadisticas', component:EstadisticasComponent },
  { path: 'deportes', component:DeportesComponent },
  { path: 'social', component:SocialComponent},
  { path: 'administrador', component:AdministradorComponent, canActivate: [AuthGuard, RoleGuard], data: { roles: ['admin']},},
  { path: 'personas', component:PersonasComponent},
  { path: 'salud', component:SaludComponent},
  { path: 'educacion', component:EducacionComponent},
  { path: 'otros', component:OtrosComponent},
  { path: 'gestiones', component:GestionesComponent},
  { path: 'login', component:LoginComponent},
  { path: 'entidades', component:EntidadesComponent },
  { path: 'catSelect',component:CatSelectComponent}

  
];

@NgModule({
  declarations: [
    AppComponent,
    MenuComponent,
    PoliticaComponent,
    ResumenComponent,
    EconomiaComponent,
    SeguridadComponent,
    EstadisticasComponent,
    DeportesComponent,
    SocialComponent,
    TodosComponent,
    PoliticaEstadisticasComponent,
    PrincipalComponent,
    AdministradorComponent,
    PersonasComponent,
    GestionesComponent,
    SaludComponent,
    LoginComponent,
    EducacionComponent,
    OtrosComponent,
    EntidadesComponent,
    CatSelectComponent,
    EstadisticasEntiPersonasComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    RouterModule.forRoot(routes),
    HttpClientModule,
    MatDatepickerModule,
    MatInputModule,
    MatNativeDateModule,
    FormsModule,
    BrowserAnimationsModule, 
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
    MatToolbarModule,
    NgChartsModule,
    MatSelectModule,
    MatCardModule, 
    AngularFireModule.initializeApp(environment.firebase),
   AngularFireAuthModule,
    AngularFireAuthModule, 
    MatTooltipModule


  ],
  providers: [
    provideClientHydration(),
    provideAnimationsAsync(),
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }

  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
