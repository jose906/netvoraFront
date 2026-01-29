import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Router } from '@angular/router';
import { JsonData } from '../interfaces/JsonData';
import { ApiService } from  '../services/api.service';
import { ResumeInterface } from '../interfaces/ResumeInterface'

@Component({
  selector: 'app-resumen',
  templateUrl: './resumen.component.html',
  styleUrl: './resumen.component.css'
})
export class ResumenComponent {

  texto: string = '';
  dato: JsonData ;
  resumen: ResumeInterface[]=[];
  isLoading: boolean = true;

  constructor(private route: ActivatedRoute, private router: Router, private apiService: ApiService) {

    const navigation = this.router.getCurrentNavigation();
    this.dato = navigation?.extras.state?.['datos'] || { texto: 'Sin información', categoria: ['Desconocido'] ,url_web:"hols"};

  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.texto = params.get('texto') || 'Sin información';
    });
    this.getResumen()

  }
 
  goBack(): void {
    this.router.navigate(['/']);
  }


  getResumen(): void {
    this.apiService.getResumen({url:this.dato.url_web}).subscribe({
      next: (response:ResumeInterface[]) => {
        console.log(response)
        this.resumen = response
        console.log(this.resumen[0]['resumen'])
        this.isLoading = false
      },
      error: (err) => {

        console.error('Error al enviar dato:', err);
        this.isLoading = false
      }

    })
  }

}
