import {Component,Input,ChangeDetectionStrategy,ChangeDetectorRef,SimpleChanges, OnChanges} from '@angular/core';
import { finalize } from 'rxjs/operators';
import { ChartData, ChartOptions, ChartType } from 'chart.js';
import { ApiService } from '../../services/api.service';
import { StatsResponse,EmergingTopicItem } from '../../interfaces/data/mainDashboard';
import { NETVORA_PALETTE,exportCanvasWithWhiteBg } from '../../utils/helpers';
import { users } from '../../interfaces/users';
import { Router } from '@angular/router';

type EntItem = { entidad: string; total: number };

@Component({
  selector: 'app-todos',
  templateUrl: './todos.component.html',
  styleUrls: ['./todos.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodosComponent implements OnChanges {
  @Input() startDate!: Date | null;
  @Input() endDate!: Date | null;
  @Input() selectedUsers: string[] = [];
  @Input() searchText:string = '';
  @Input() users:users[] = [] ;

  loading = false;
  errorMsg = '';

  // ======= KPI =======
  totalPosts = 0;

  totalReplies = 0;
    totalRepliesNegativo = 0;
totalRepliesNeutro = 0;
totalRepliesPositivo = 0;


// ======= Resumen de comentarios =======

repliesNegativePercent = 0;
repliesNeutralPercent = 0;
repliesPositivePercent = 0;

repliesDominantSentiment = 'Sin datos';
repliesDominantPercent = 0;

// ======= Resumen de análisis =======

analysisTopTopic = '';
analysisTopTopicTotal = 0;

analysisMostPositiveTopic = '';
analysisMostNegativeTopic = '';

analysisPositivePercent = 0;
analysisNegativePercent = 0;
analysisNeutralPercent = 0;



  topLocacion: EntItem[] = [];
  topOrganizacion: EntItem[] = [];
  topPersona: EntItem[] = [];

  // ======= Chart selectors =======
  sentimentChartType: ChartType = 'doughnut';
  categoriesChartType: ChartType = 'bar';

  readonly sentimentTypeOptions: ChartType[] = ['doughnut', 'pie', 'bar'];
  readonly categoriesTypeOptions: ChartType[] = ['bar', 'doughnut', 'pie'];
  viewModeReplies: 'table' | 'chart' = 'table';

  currentEmergingTopics: EmergingTopicItem[] = [];

  topicSentimentData: ChartData<'bar'> = {
  labels: [],
  datasets: []
};


  timelineData: ChartData<'line'> = {
    labels: [],
    datasets: [
      {
        label: 'Posts por día',
      data: [],
      borderColor: NETVORA_PALETTE.accent,
      backgroundColor: 'rgba(109,40,217,1)',
      tension: 0.35,
      fill: false,
      pointRadius: 2,
      pointBackgroundColor: NETVORA_PALETTE.accent,
      pointHoverRadius: 4,
      borderWidth: 2
      },
    ],
  };
    // ======= Resumen de actividad =======
  activityTotal = 0;
  activityAverage = 0;
  activityPeak = 0;
  activityPeakDate = '';
  activityVariation: number | null = null;
  // ======= Top tópicos =======
  topTopicsData: ChartData<'bar'> = {
    labels: [],
    datasets: [
      {
        label: 'Publicaciones',
        data: [],
        backgroundColor: NETVORA_PALETTE.accent,
        borderRadius: 7,
        borderSkipped: false,
        barThickness: 22,
        maxBarThickness: 26
      }
    ]
  };
  // =========================================================
// EVOLUCIÓN DE TÓPICOS
// =========================================================

topicsTimelineData: ChartData<'line'> = {
  labels: [],
  datasets: []
};

readonly topicsTimelineOptions: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,

  interaction: {
    mode: 'index',
    intersect: false
  },

  plugins: {
    legend: {
      display: true,
      position: 'bottom',
      labels: {
        usePointStyle: true,
        pointStyle: 'circle',
        padding: 18,
        boxWidth: 8,
        boxHeight: 8
      }
    },

    tooltip: {
      enabled: true,
      callbacks: {
        label: (context) => {
          const value = Number(context.raw ?? 0);
          return `${context.dataset.label}: ${value.toLocaleString()} publicaciones`;
        }
      }
    }
  },

  scales: {
    x: {
      border: {
        display: false
      },

      grid: {
        display: false
      },

      ticks: {
        color: '#64748b',
        maxRotation: 0
      }
    },

    y: {
      beginAtZero: true,

      border: {
        display: false
      },

      grid: {
        color: 'rgba(15, 23, 42, 0.05)'
      },

      ticks: {
        precision: 0,
        color: '#64748b'
      }
    }
  }
};

readonly topicSentimentOptions: ChartOptions<'bar'> = {

  responsive: true,
  maintainAspectRatio: false,

  indexAxis: 'y',

  animation: {
    duration: 450
  },

  interaction: {
    mode: 'index',
    intersect: false
  },

  plugins: {

    legend: {
      display: true,
      position: 'bottom',

      labels: {
        usePointStyle: true,
        boxWidth: 7,
        boxHeight: 7,
        padding: 16,
        color: '#64748b',
        font: {
          size: 10
        }
      }
    },

    tooltip: {

      callbacks: {

        label: (context) => {

          const value =
            Number(context.raw || 0);

          return `${context.dataset.label}: ${value.toFixed(1)}%`;

        }

      }

    }

  },

  scales: {

    x: {

      stacked: true,

      min: 0,
      max: 100,

      border: {
        display: false
      },

      grid: {
        color: 'rgba(15, 23, 42, 0.05)'
      },

      ticks: {

        color: '#94a3b8',

        font: {
          size: 9
        },

        callback: value =>
          `${value}%`

      }

    },

    y: {

      stacked: true,

      border: {
        display: false
      },

      grid: {
        display: false
      },

      ticks: {

        color: '#475569',

        font: {
          size: 10
        }

      }

    }

  }

};

emergingTopicsData: ChartData<'bar'> = {
  labels: [],
  datasets: [
    {
      label: 'Crecimiento',
      data: [],
      backgroundColor: '#6d28d9',
      borderRadius: 7,
      borderSkipped: false,
      barThickness: 22,
      maxBarThickness: 26
    }
  ]
};
readonly emergingTopicsOptions: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,

  indexAxis: 'y',

  animation: {
    duration: 500
  },

  interaction: {
    mode: 'nearest',
    intersect: false
  },

  plugins: {
    legend: {
      display: false
    },
    tooltip: {
  enabled: true,

  callbacks: {
    title: (items) => {
      if (!items.length) return '';

      const index = items[0].dataIndex;

      const topic = Array.isArray(this.currentEmergingTopics)
        ? this.currentEmergingTopics[index]
        : null;

      return topic?.topic_name || '';
    },

    label: (context) => {
      const index = context.dataIndex;

      const topic = Array.isArray(this.currentEmergingTopics)
        ? this.currentEmergingTopics[index]
        : null;

      if (!topic) {
        return '';
      }

      return [
        `Actual: ${Number(topic.total_actual || 0).toLocaleString()}`,
        `Anterior: ${Number(topic.total_anterior || 0).toLocaleString()}`,
        `Crecimiento: +${Number(topic.diferencia || 0).toLocaleString()}`
      ];
    },

    afterLabel: (context) => {
      const index = context.dataIndex;

      const topic = Array.isArray(this.currentEmergingTopics)
        ? this.currentEmergingTopics[index]
        : null;

      if (!topic) return '';

      if (topic.tendencia === 'NUEVO') {
        return 'Estado: NUEVO';
      }

      if (topic.porcentaje === null || topic.porcentaje === undefined) {
        return '';
      }

      const porcentaje = Number(topic.porcentaje);

      return `Variación: ${porcentaje > 0 ? '+' : ''}${porcentaje.toLocaleString()}%`;
    }
  }
}

    
  },

  scales: {
    x: {
      beginAtZero: true,

      border: {
        display: false
      },

      grid: {
        color: 'rgba(15, 23, 42, 0.05)'
      },

      ticks: {
        precision: 0,
        color: '#64748b'
      }
    },

    y: {
      border: {
        display: false
      },

      grid: {
        display: false
      },

      ticks: {
        color: '#334155',

        font: {
          size: 12,
          weight: 600
        }
      }
    }
  }
};

  sentimentData: ChartData<'doughnut' | 'pie' | 'bar'> = {
    labels: ['Negativo', 'Neutro', 'Positivo'],
    datasets: [{ label: 'Sentimientos', data: [0, 0, 0],

      backgroundColor: [
        NETVORA_PALETTE.sentiment.negativo,
        NETVORA_PALETTE.sentiment.neutro,
        NETVORA_PALETTE.sentiment.positivo
      ],
      borderWidth: 0
     }],
  };

  categoriesData: ChartData<'doughnut' | 'pie' | 'bar'> = {
    labels: [],
    datasets: [{ label: 'Categorías', data: [], 
      backgroundColor: NETVORA_PALETTE.categories,
      borderWidth: 0
    }],
  };
  readonly topTopicsOptions: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,

  indexAxis: 'y',

  animation: {
    duration: 500
  },

  interaction: {
    mode: 'nearest',
    intersect: false
  },

  plugins: {
    legend: {
      display: false
    },

    tooltip: {
      enabled: true,
      callbacks: {
        label: (context) => {
          const value = Number(context.raw || 0);
          return `${value.toLocaleString()} publicaciones`;
        }
      }
    }
  },

  scales: {
    x: {
      beginAtZero: true,

      border: {
        display: false
      },

      grid: {
        color: 'rgba(15, 23, 42, 0.05)'
      },

      ticks: {
        precision: 0,
        color: '#64748b'
      }
    },

    y: {
      border: {
        display: false
      },

      grid: {
        display: false
      },

      ticks: {
        color: '#334155',
        font: {
          size: 12,
          weight: 600
        }
      }
    }
  }
};


  // ======= Options =======
  readonly commonCardChartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true },
      tooltip: { enabled: true },
    },
  };
  readonly repliesChartOptions: ChartOptions<'doughnut'> = {

  responsive: true,
  maintainAspectRatio: false,

  cutout: '72%',

  animation: {
    duration: 450
  },

  plugins: {

    legend: {
      display: true,
      position: 'bottom',

      labels: {
        usePointStyle: true,
        boxWidth: 7,
        boxHeight: 7,
        padding: 16,

        color: '#64748b',

        font: {
          size: 10
        }
      }
    },

    tooltip: {

      callbacks: {

        label: (context) => {

          const value =
            Number(context.raw || 0);

          const dataset =
            context.dataset.data as number[];

          const total =
            dataset.reduce(
              (sum, item) =>
                sum + Number(item || 0),
              0
            );

          const percentage =
            total > 0
              ? (value / total) * 100
              : 0;

          return `${context.label}: ${value.toLocaleString()} (${percentage.toFixed(1)}%)`;

        }

      }

    }

  },

  elements: {

    arc: {
      borderWidth: 0,
      hoverOffset: 5
    }

  }

};
  readonly lineOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true },
      tooltip: { enabled: true },
    },
    scales: {
      x: { ticks: { maxRotation: 0 } },
      y: { beginAtZero: true },
    },
  };
  repliesChartData: ChartData<'doughnut'> = {
  labels: ['Negativo', 'Neutro', 'Positivo'],
  datasets: [{
    data: [0, 0, 0],
    backgroundColor: [
      NETVORA_PALETTE.sentiment.negativo,
      NETVORA_PALETTE.sentiment.neutro,
      NETVORA_PALETTE.sentiment.positivo
    ],
    borderWidth: 0
  }]
};

constructor(
  private api: ApiService,
  private cdr: ChangeDetectorRef,
  private router: Router
) {}
  ngOnChanges(changes: SimpleChanges): void {
  const startChanged = !!changes['startDate'];
  const endChanged = !!changes['endDate'];
  const usersChanged = !!changes['users'];
  const selChanged = !!changes['selectedUsers'];
  const searchChanged = !!changes['searchText'];

  if (!this.startDate) return;

  // si no hay usuarios seleccionados y tampoco hay usuarios disponibles, no llames backend
  const usersToSend = this.selectedUsers.length > 0
    ? this.selectedUsers
    : (this.users ?? []).map(u => String(u.idTweetUser));

  if (!usersToSend.length) return;

  if (startChanged || endChanged || usersChanged || selChanged || searchChanged) {
    this.cargarDatos();
  }
}

 public cargarDatos(): void {
  if (!this.startDate) return;

  const usersToSend = this.selectedUsers.length > 0
    ? this.selectedUsers.map(String)
    : (this.users ?? []).map(u => String(u.idTweetUser));

  if (!usersToSend.length) {
    this.totalPosts = 0;
    this.topLocacion = [];
    this.topOrganizacion = [];
    this.topPersona = [];
    this.errorMsg = 'No hay usuarios disponibles para consultar.';
    this.cdr.markForCheck();
    return;
  }

  const body: any = {
    start: this.toYMD(this.startDate),
    users: usersToSend,
  };

  if (this.endDate) body.end = this.toYMD(this.endDate);

  const search = this.searchText?.trim();
  if (search) body.search = search;

  

  this.loading = true;
  this.errorMsg = '';
  this.cdr.markForCheck();

  this.api.getAllData(body)
    .pipe(finalize(() => {
      this.loading = false;
      this.cdr.markForCheck();
    }))
    .subscribe({
      next: (res) => this.mapResponse(res),
      error: (err) => {
      
        this.errorMsg = 'No se pudo cargar el dashboard.';
        this.cdr.markForCheck();
      },
    });
}

  private mapResponse(res: StatsResponse): void {
    // ======= KPI =======
    this.totalPosts = res?.posts?.total_posts ?? 0;
    this.totalReplies =
    res?.total_replies?.total ?? 0;

  this.totalRepliesNegativo =
    res?.total_replies?.negativo ?? 0;

  this.totalRepliesNeutro =
    res?.total_replies?.neutro ?? 0;

  this.totalRepliesPositivo =
    res?.total_replies?.positivo ?? 0;
    // =========================================================
// DISTRIBUCIÓN DE COMENTARIOS
// =========================================================

const repliesSentimentTotal =
  this.totalRepliesNegativo +
  this.totalRepliesNeutro +
  this.totalRepliesPositivo;


if (repliesSentimentTotal > 0) {

  this.repliesNegativePercent =
    Math.round(
      (this.totalRepliesNegativo / repliesSentimentTotal) * 100
    );

  this.repliesNeutralPercent =
    Math.round(
      (this.totalRepliesNeutro / repliesSentimentTotal) * 100
    );

  this.repliesPositivePercent =
    Math.round(
      (this.totalRepliesPositivo / repliesSentimentTotal) * 100
    );


  const sentiments = [
    {
      name: 'Negativo',
      value: this.totalRepliesNegativo,
      percent: this.repliesNegativePercent
    },
    {
      name: 'Neutral',
      value: this.totalRepliesNeutro,
      percent: this.repliesNeutralPercent
    },
    {
      name: 'Positivo',
      value: this.totalRepliesPositivo,
      percent: this.repliesPositivePercent
    }
  ];


  const dominant =
    sentiments.reduce(
      (max, item) =>
        item.value > max.value
          ? item
          : max
    );


  this.repliesDominantSentiment =
    dominant.name;

  this.repliesDominantPercent =
    dominant.percent;

} else {

  this.repliesNegativePercent = 0;
  this.repliesNeutralPercent = 0;
  this.repliesPositivePercent = 0;

  this.repliesDominantSentiment =
    'Sin datos';

  this.repliesDominantPercent = 0;

}

    console.log(res)
   
    
    // Top 3 (tomas los primeros 3 del array ya ordenado)
    this.topLocacion = (res?.locacion ?? []).slice(0, 3);
    this.topOrganizacion = (res?.organizacion ?? []).slice(0, 3);
    this.topPersona = (res?.persona ?? []).slice(0, 3);

 

// =========================================================
// TOP TÓPICOS + EVOLUCIÓN
// =========================================================

const topicTimeline = Array.isArray(res?.topics_timeline)
  ? res.topics_timeline
  : [];


// =========================================================
// 1. AGRUPAR TÓPICOS
// =========================================================

const topicMap = new Map<
  number,
  {
    topic_id: number;
    topic_name: string;
    total: number;
  }
>();

topicTimeline.forEach((item: any) => {

  const topicId = Number(item.topic_id);

  if (!topicMap.has(topicId)) {

    topicMap.set(topicId, {
      topic_id: topicId,
      topic_name: String(item.topic_name || 'Sin nombre'),
      total: 0
    });

  }

  const topic = topicMap.get(topicId);

  if (topic) {
    topic.total += Number(item.total || 0);
  }

});


// =========================================================
// 2. TOP TÓPICOS POR VOLUMEN
// =========================================================

const topTopics = Array.from(topicMap.values())
  .sort((a, b) => b.total - a.total)
  .slice(0, 10);
  // =========================================================
// RESUMEN DEL TÓPICO MÁS ACTIVO
// =========================================================

if (topTopics.length > 0) {

  this.analysisTopTopic =
    topTopics[0].topic_name || 'Sin nombre';

  this.analysisTopTopicTotal =
    Number(topTopics[0].total || 0);

} else {

  this.analysisTopTopic = '';
  this.analysisTopTopicTotal = 0;

}


this.topTopicsData = {

  labels: topTopics.map((item) =>
    this.truncateTopic(
      item.topic_name,
      58
    )
  ),

  datasets: [
    {
      label: 'Publicaciones',

      data: topTopics.map((item) =>
        item.total
      ),

      backgroundColor: NETVORA_PALETTE.accent,

      borderRadius: 7,
      borderSkipped: false,

      barThickness: 22,
      maxBarThickness: 26
    }
  ]

};


// =========================================================
// 3. FECHAS PARA EVOLUCIÓN
// =========================================================

const fechas = Array.from(
  new Set(
    topicTimeline.map(
      (item: any) => String(item.fecha)
    )
  )
);


fechas.sort((a, b) => {

  return (
    new Date(a).getTime() -
    new Date(b).getTime()
  );

});


// =========================================================
// 4. TOP 5 PARA LA EVOLUCIÓN
// =========================================================

const timelineTopics = Array.from(topicMap.values())
  .sort((a, b) => b.total - a.total)
  .slice(0, 5);


const topicColors = [
  '#6d28d9',
  '#2563eb',
  '#059669',
  '#ea580c',
  '#dc2626'
];


// =========================================================
// 5. DATASET EVOLUCIÓN
// =========================================================

this.topicsTimelineData = {

  labels: fechas.map((fecha) =>
    this.formatTopicTimelineLabel(fecha)
  ),

  datasets: timelineTopics.map(
    (topic, index) => {

      const data = fechas.map((fecha) => {

        const item = topicTimeline.find(
          (row: any) =>
            Number(row.topic_id) === topic.topic_id &&
            String(row.fecha) === fecha
        );

        return item
          ? Number(item.total ?? 0)
          : 0;

      });


      const color =
        topicColors[
          index % topicColors.length
        ];


      return {

        label: this.truncateTopic(
          topic.topic_name,
          38
        ),

        data,

        borderColor: color,
        backgroundColor: color,

        tension: 0.35,

        fill: false,

        pointRadius: 3,
        pointHoverRadius: 5,

        borderWidth: 2

      };

    }
  )

};



// =========================================================
// TÓPICOS EMERGENTES
// =========================================================

const emergingTopics = Array.isArray(res?.emerging_topics)? res.emerging_topics: [];
this.currentEmergingTopics = emergingTopics;

this.emergingTopicsData = {
  labels: emergingTopics.map((item: any) =>
    this.truncateTopic(
      String(item.topic_name || 'Sin nombre'),
      55
    )
  ),

  datasets: [
    {
      label: 'Crecimiento',

      data: emergingTopics.map((item: any) =>
        Number(item.diferencia || 0)
      ),

      backgroundColor: '#6d28d9',

      borderRadius: 7,
      borderSkipped: false,

      barThickness: 22,
      maxBarThickness: 26
    }
  ]
};
// =========================================================
// SENTIMIENTO POR TÓPICO
// =========================================================

const topicSentiment = Array.isArray(res?.topic_sentiment)
  ? res.topic_sentiment
  : [];
  // =========================================================
// RESUMEN DE SENTIMIENTO POR TÓPICO
// =========================================================

let positiveTotal = 0;
let neutralTotal = 0;
let negativeTotal = 0;

let mostPositive: any = null;
let mostNegative: any = null;

let mostPositivePercent = -1;
let mostNegativePercent = -1;


topicSentiment.forEach((item: any) => {

  const positivos =
    Number(item.positivos || 0);

  const neutrales =
    Number(item.neutrales || 0);

  const negativos =
    Number(item.negativos || 0);


  const total =
    positivos +
    neutrales +
    negativos;


  positiveTotal += positivos;
  neutralTotal += neutrales;
  negativeTotal += negativos;


  if (total <= 0) {
    return;
  }


  const positivePercent =
    (positivos / total) * 100;

  const negativePercent =
    (negativos / total) * 100;


  if (positivePercent > mostPositivePercent) {

    mostPositivePercent =
      positivePercent;

    mostPositive =
      item;

  }


  if (negativePercent > mostNegativePercent) {

    mostNegativePercent =
      negativePercent;

    mostNegative =
      item;

  }

});
const sentimentGrandTotal =
  positiveTotal +
  neutralTotal +
  negativeTotal;


if (sentimentGrandTotal > 0) {

  this.analysisPositivePercent =
    Math.round(
      (positiveTotal / sentimentGrandTotal) * 100
    );

  this.analysisNeutralPercent =
    Math.round(
      (neutralTotal / sentimentGrandTotal) * 100
    );

  this.analysisNegativePercent =
    Math.round(
      (negativeTotal / sentimentGrandTotal) * 100
    );

} else {

  this.analysisPositivePercent = 0;
  this.analysisNeutralPercent = 0;
  this.analysisNegativePercent = 0;

}


this.analysisMostPositiveTopic =
  mostPositive?.topic_name || '';

this.analysisMostNegativeTopic =
  mostNegative?.topic_name || '';

this.topicSentimentData = {

  labels: topicSentiment.map((item: any) =>
    this.truncateTopic(
      String(item.topic_name || 'Sin nombre'),
      45
    )
  ),

  datasets: [

    {
      label: 'Positivo',

      data: topicSentiment.map((item: any) => {

        const positivos =
          Number(item.positivos || 0);

        const total =
          positivos +
          Number(item.neutrales || 0) +
          Number(item.negativos || 0);

        return total > 0
          ? (positivos / total) * 100
          : 0;
      }),

      backgroundColor: '#16a34a',

      borderRadius: 0,
      borderSkipped: false
    },


    {
      label: 'Neutral',

      data: topicSentiment.map((item: any) => {

        const neutrales =
          Number(item.neutrales || 0);

        const total =
          Number(item.positivos || 0) +
          neutrales +
          Number(item.negativos || 0);

        return total > 0
          ? (neutrales / total) * 100
          : 0;
      }),

      backgroundColor: '#94a3b8',

      borderRadius: 0,
      borderSkipped: false
    },


    {
      label: 'Negativo',

      data: topicSentiment.map((item: any) => {

        const negativos =
          Number(item.negativos || 0);

        const total =
          Number(item.positivos || 0) +
          Number(item.neutrales || 0) +
          negativos;

        return total > 0
          ? (negativos / total) * 100
          : 0;
      }),

      backgroundColor: '#dc2626',

      borderRadius: 0,
      borderSkipped: false
    }

  ]

};
    

 // =========================================================
// TIMELINE / ACTIVIDAD
// =========================================================

const tl = res?.time_line ?? [];

const timelineRows = tl.map((x: any) => ({
  fecha: String(x.fecha ?? ''),
  total: Number(x.total ?? 0)
}));

// ---------------------------------------------------------
// RESUMEN
// ---------------------------------------------------------

this.activityTotal = timelineRows.reduce(
  (sum, item) => sum + item.total,
  0
);

this.activityAverage = timelineRows.length
  ? Math.round(this.activityTotal / timelineRows.length)
  : 0;


// ---------------------------------------------------------
// PICO DE ACTIVIDAD
// ---------------------------------------------------------

const peakItem = timelineRows.reduce(
  (max, item) =>
    item.total > max.total
      ? item
      : max,
  {
    fecha: '',
    total: 0
  }
);

this.activityPeak = peakItem.total;

this.activityPeakDate = peakItem.fecha
  ? this.formatTimelineLabel(peakItem.fecha)
  : '';


// ---------------------------------------------------------
// VARIACIÓN ÚLTIMO DÍA VS DÍA ANTERIOR
// ---------------------------------------------------------

if (timelineRows.length >= 2) {

  const current =
    timelineRows[timelineRows.length - 1].total;

  const previous =
    timelineRows[timelineRows.length - 2].total;

  if (previous > 0) {

    this.activityVariation =
      ((current - previous) / previous) * 100;

  } else if (current > 0) {

    this.activityVariation = 100;

  } else {

    this.activityVariation = 0;

  }

} else {

  this.activityVariation = null;

}


// ---------------------------------------------------------
// GRÁFICO
// ---------------------------------------------------------

this.timelineData = {

  labels: timelineRows.map(
    item => this.formatTimelineLabel(item.fecha)
  ),

  datasets: [
    {
      label: 'Publicaciones',

      data: timelineRows.map(
        item => item.total
      ),

      borderColor: NETVORA_PALETTE.accent,

      backgroundColor:
        'rgba(109, 40, 217, 0.08)',

      fill: true,

      tension: 0.35,

      borderWidth: 2,

      pointRadius: timelineRows.map(
        item =>
          item.total === this.activityPeak
            ? 5
            : 2
      ),

      pointHoverRadius: 6,

      pointBackgroundColor:
        NETVORA_PALETTE.accent,

      pointBorderColor: '#ffffff',

      pointBorderWidth: timelineRows.map(
        item =>
          item.total === this.activityPeak
            ? 2
            : 0
      )
    }
  ]
}; 

    // ======= Sentimientos =======
    const s = res?.sentimientos?.posts_per_sentiment ?? ({} as any);
    const neg = Number(s.negativo || 0);
    const neu = Number(s.neutro || 0);
    const pos = Number(s.positivo || 0);

    this.sentimentData = {
      labels: ['Negativo', 'Neutro', 'Positivo'],
      datasets: [{ label: 'Sentimientos', 
        
        data: [neg, neu, pos],
         backgroundColor: [
        NETVORA_PALETTE.sentiment.negativo,
        NETVORA_PALETTE.sentiment.neutro,
        NETVORA_PALETTE.sentiment.positivo
      ],
      borderWidth: 0
        


      }],
    };

    // ======= Categorías =======
    const pc = res?.posts_categories?.posts_per_category ?? ({} as any);
    const catLabels = Object.keys(pc);
    const catData = catLabels.map((k) => Number(pc[k] || 0));

    this.categoriesData = {
      labels: catLabels,
      datasets: [{ 
        label: 'Categorías', data: catData, 
        backgroundColor: NETVORA_PALETTE.categories,
      borderWidth: 0
        


      }],
    };

    this.cdr.markForCheck();
  }

  // ======= helpers =======
  private toYMD(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

 private formatTimelineLabel(fecha: string): string {

  if (!fecha) {
    return '';
  }

  const cleanDate =
    fecha.includes('T')
      ? fecha.split('T')[0]
      : fecha.split(' ')[0];

  const parts = cleanDate.split('-');

  if (parts.length !== 3) {
    return fecha;
  }

  const [, month, day] = parts;

  return `${day}/${month}`;
}
  // ======= downloads (ya los tenías) =======
  downloadChart(event: Event) {
    const chartContainer = (event.target as HTMLElement).closest('.chart');
    const canvas = chartContainer?.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas) return;

    const link = document.createElement('a');
    link.href = exportCanvasWithWhiteBg(canvas);
    link.download = `grafico-${Date.now()}.png`;
    link.click();
  }
  get activityVariationPositive(): boolean {
  return (this.activityVariation ?? 0) > 0;
}

get activityVariationNegative(): boolean {
  return (this.activityVariation ?? 0) < 0;
}

get activityVariationText(): string {

  if (this.activityVariation == null) {
    return 'Sin comparación';
  }

  const value =
    Math.abs(this.activityVariation);

  if (this.activityVariation > 0) {
    return `+${value.toFixed(1)}%`;
  }

  if (this.activityVariation < 0) {
    return `-${value.toFixed(1)}%`;
  }

  return '0%';
}

  public downloadAllCharts() {
    const canvases = document.querySelectorAll('.chart canvas') as NodeListOf<HTMLCanvasElement>;
    if (!canvases.length) return;

    canvases.forEach((canvas, index) => {
      const link = document.createElement('a');
      link.href = exportCanvasWithWhiteBg(canvas);
      link.download = `grafico-${index + 1}-${Date.now()}.png`;
      link.click();
    });
  }
  private formatTopicTimelineLabel(fecha: string): string {
  const dt = new Date(fecha);

  if (Number.isNaN(dt.getTime())) {
    return fecha;
  }

  const dd = String(
    dt.getUTCDate()
  ).padStart(2, '0');

  const mm = String(
    dt.getUTCMonth() + 1
  ).padStart(2, '0');

  return `${dd}/${mm}`;
}

  private truncateTopic(text: string, maxLength: number): string {
  if (!text) return 'Sin nombre';

  return text.length > maxLength
    ? `${text.substring(0, maxLength)}…`
    : text;
}
// =========================================================
// ABRIR DETALLE DE TÓPICO
// =========================================================

openTopic(topic: EmergingTopicItem): void {

  const topicId = Number(topic?.topic_id);

  if (!topicId) {
    return;
  }

  this.router.navigate(
    ['/topics', topicId],
    {
      state: {
        topic_id: topicId,
        topic_name: topic.topic_name,

        // dejamos también el contexto actual preparado
        startDate: this.startDate,
        endDate: this.endDate,

        selectedUsers:
          this.selectedUsers.length > 0
            ? [...this.selectedUsers]
            : (this.users ?? []).map(
                user => String(user.idTweetUser)
              ),

        searchText: this.searchText
      }
    }
  );
}
getEntityPercent(
  items: EntItem[],
  total: number
): number {

  if (!items?.length) {
    return 0;
  }

  const max = Math.max(
    ...items.map(item => Number(item.total || 0))
  );

  if (max <= 0) {
    return 0;
  }

  return Math.max(
    4,
    Math.round((Number(total || 0) / max) * 100)
  );
}
formatRank(index: number): string {
  return String(index + 1).padStart(2, '0');
}

  trackByEntidad = (_: number, item: { entidad: string }) => item.entidad;
}
