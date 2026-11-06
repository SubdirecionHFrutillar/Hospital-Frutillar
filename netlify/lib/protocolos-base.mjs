// Protocolos clínicos "de partida": áreas (fijas, se cambian en código) y los documentos iniciales.
// Desde el portal se agregan, editan y eliminan documentos; esos cambios quedan en Netlify Blobs
// (almacén "protocolos") y esta lista solo se usa mientras nadie haya editado nada.
export default {
  "titulo": "Protocolos clínicos",
  "descripcion": "Protocolos y procedimientos clínicos vigentes del Hospital de Frutillar, ordenados por área de atención. Los documentos se abren en el portal; algunos todavía enlazan a Google Drive (si no tiene acceso, solicítelo a la Unidad de Calidad).",
  "areas": [
    {
      "id": "urgencia",
      "nombre": "Urgencia",
      "icono": "emergency",
      "descripcion": "Categorización, reanimación, derivación y situaciones de riesgo.",
      "documentos": [
        {
          "id": "categorizacion-pacientes",
          "titulo": "Categorización de pacientes",
          "codigo": "AOC",
          "url": "https://drive.google.com/drive/folders/1RVs4uCWlpsiuRJIPP7DP5d7LZm1ImIxI"
        },
        {
          "id": "clave-azul",
          "titulo": "Clave azul",
          "codigo": "AOC",
          "url": "https://drive.google.com/drive/folders/13mUNLtIPmBgIJEBO9tOSy4N4UW29KDOB"
        },
        {
          "id": "reanimacion-cardiopulmonar",
          "titulo": "Reanimación cardiopulmonar",
          "codigo": "GCL",
          "url": "https://drive.google.com/drive/folders/13xf5DjnFFwmxxGuieqqn7nOZvVAJyRbz"
        },
        {
          "id": "derivacion-pacientes-urgencia",
          "titulo": "Derivación de pacientes (Urgencia)",
          "codigo": "AOC",
          "url": "https://drive.google.com/drive/folders/1bMi9rEikJJJsAWQhRduWFeS-HcvuXLRc"
        },
        {
          "id": "agitacion-psicomotora",
          "titulo": "Agitación psicomotora",
          "codigo": "GCL",
          "url": "https://drive.google.com/drive/folders/1M1YiFzEZS5Tr57vbcvH9MGi_8z_hv7AZ"
        },
        {
          "id": "pacientes-ideacion-suicida",
          "titulo": "Pacientes con ideación suicida",
          "codigo": "GCL",
          "url": "https://drive.google.com/drive/folders/1tJSNMwfxwaEFlDhQb4MJX86-lPMwI74C"
        },
        {
          "id": "cadena-custodia",
          "titulo": "Cadena de custodia",
          "codigo": "",
          "url": "https://drive.google.com/file/d/1utMCZYcE6urye55-oDEQoHQSxW0mZuxe/view"
        }
      ]
    },
    {
      "id": "hospitalizacion",
      "nombre": "Hospitalización",
      "icono": "bed",
      "descripcion": "Atención de enfermería, continuidad y seguridad del paciente hospitalizado.",
      "documentos": [
        {
          "id": "atencion-enfermeria",
          "titulo": "Atención de enfermería",
          "codigo": "GCL",
          "url": "https://drive.google.com/drive/folders/1tUIIKuvfs9y4Xz0PDSrz44jHPO6tVDSx"
        },
        {
          "id": "entrega-turno",
          "titulo": "Entrega de turno",
          "codigo": "AOC",
          "url": "https://drive.google.com/drive/folders/1NZD4mf4mkI3_jucU09kHzLAlCRdYn86v"
        },
        {
          "id": "identificacion-pacientes",
          "titulo": "Identificación de pacientes",
          "codigo": "GCL",
          "url": "https://drive.google.com/drive/folders/1hjudoGHN9ecVB2fk4B84HLCCV9aYZAW5"
        },
        {
          "id": "realimentacion-paciente",
          "titulo": "Realimentación del paciente",
          "codigo": "",
          "url": "https://drive.google.com/file/d/1olpx3gSbfAu5OfKaDhWQ-qJfkYPW44BC/view"
        },
        {
          "id": "atencion-kinesica-respiratoria",
          "titulo": "Atención kinésica respiratoria",
          "codigo": "AP",
          "url": "https://drive.google.com/drive/folders/1H28PZMBa0UGB6PiozWOPiG60YaWSqPPH"
        },
        {
          "id": "atencion-kinesica-musculoesqueletica",
          "titulo": "Atención kinésica musculoesquelética",
          "codigo": "AP",
          "url": "https://drive.google.com/drive/folders/1Gw3pjLqBFZXDwwKEl02H7q0x0Xf7tMFK"
        }
      ]
    },
    {
      "id": "hospitalizacion-domiciliaria",
      "nombre": "Hospitalización Domiciliaria",
      "icono": "home_health",
      "descripcion": "Ingreso, registro y seguridad de la Unidad de Hospitalización Domiciliaria (UHD).",
      "documentos": [
        {
          "id": "derivacion-evaluacion-ingreso-uhd",
          "titulo": "Derivación y evaluación para ingreso a UHD",
          "codigo": "",
          "url": "https://drive.google.com/file/d/12ybug9ljfNMUwRyE9JfjI0P0JPmff8_W/view"
        },
        {
          "id": "registro-clinico-uhd",
          "titulo": "Registro clínico en UHD",
          "codigo": "",
          "url": "https://drive.google.com/file/d/1d29CGVdBLIdUa5vWg9_0v69skqT4bDHY/view"
        },
        {
          "id": "agresiones-uhd",
          "titulo": "Agresiones en UHD",
          "codigo": "",
          "url": "https://drive.google.com/file/d/1c0dY3HNZY0bzIHNRDzS9DN7Id2XYZrcl/view"
        },
        {
          "id": "pacientes-electrodependientes",
          "titulo": "Pacientes electrodependientes",
          "codigo": "",
          "url": "https://drive.google.com/drive/folders/1gC_UWmXwyWUX0J-4hPSVEFsDBT3F6E8J"
        },
        {
          "id": "manual-organizacional-uhd",
          "titulo": "Manual organizacional UHD",
          "codigo": "",
          "url": "https://drive.google.com/file/d/1w0e1kMJigqn15MTQcLVey-k8g5nXbrBz/view"
        }
      ],
      "url": "https://drive.google.com/drive/folders/1rsZNi9NsPVZv0w-9LSMIBFjJjNe8wQdM"
    },
    {
      "id": "laboratorio-imagenes-transfusion",
      "nombre": "Laboratorio, imágenes y transfusión",
      "icono": "biotech",
      "descripcion": "Solicitud de exámenes, valores críticos, biopsias y medicina transfusional.",
      "documentos": [
        {
          "id": "notificacion-valores-criticos",
          "titulo": "Notificación de valores críticos",
          "codigo": "AOC",
          "url": "https://drive.google.com/drive/folders/1PqXMzFLkk-nAG5Y1fNBRAXRZh7hUqktJ"
        },
        {
          "id": "solicitud-examen-imagenologico",
          "titulo": "Solicitud de examen imagenológico",
          "codigo": "AP",
          "url": "https://drive.google.com/drive/folders/1SrsEdvZhlxRtMBFd-SpMRKAkI7qpH6KU"
        },
        {
          "id": "procedimiento-biopsias",
          "titulo": "Procedimiento de biopsias",
          "codigo": "GCL",
          "url": "https://drive.google.com/drive/folders/14VG5mMUTu9Qgwo3CgRd-VGUlQNYec7dx"
        },
        {
          "id": "anatomia-patologica-etapa-preanalitica",
          "titulo": "Anatomía patológica: etapa preanalítica",
          "codigo": "AP",
          "url": "https://drive.google.com/drive/folders/1peWfrYWoQT3Gi7mErjF9Am7CTTLBsHub"
        },
        {
          "id": "indicacion-transfusion",
          "titulo": "Indicación de transfusión",
          "codigo": "GCL",
          "url": "https://drive.google.com/drive/folders/1OsdMAu4zkHujTpHuKI76GnwkFBXWczZK"
        },
        {
          "id": "medicina-transfusional-procedimiento",
          "titulo": "Medicina transfusional: procedimiento",
          "codigo": "AP",
          "url": "https://drive.google.com/drive/folders/1OB0QwhnPaQvO4aI0tQV0LzdtVv04dJVu"
        },
        {
          "id": "trazabilidad-componentes-sanguineos",
          "titulo": "Trazabilidad de componentes sanguíneos",
          "codigo": "AP",
          "url": "https://drive.google.com/drive/folders/1HTmL73Z1u7Fy0P9scfmDTTw4nJbBS8hL"
        }
      ]
    },
    {
      "id": "farmacia-esterilizacion",
      "nombre": "Farmacia y esterilización",
      "icono": "medication",
      "descripcion": "Medicamentos, stock y procesos de esterilización.",
      "documentos": [
        {
          "id": "procedimientos-farmacia",
          "titulo": "Procedimientos de Farmacia",
          "codigo": "AP",
          "url": "https://drive.google.com/drive/folders/1YcfbA1aoFeiKatVNJ65oJOqmsfNL-I8x"
        },
        {
          "id": "almacenamiento-conservacion-medicamentos",
          "titulo": "Almacenamiento y conservación de medicamentos",
          "codigo": "AP",
          "url": "https://drive.google.com/drive/folders/1wobM-dICgsdJzpxDvtMK8zvhAF0Xky6R"
        },
        {
          "id": "stock-minimo-medicamentos-insumos",
          "titulo": "Stock mínimo de medicamentos e insumos",
          "codigo": "AP",
          "url": "https://drive.google.com/drive/folders/17XVO2KoRAB6UzXQltKDaLfaaU5HaYvQo"
        },
        {
          "id": "esterilizacion",
          "titulo": "Esterilización",
          "codigo": "AP",
          "url": "https://drive.google.com/drive/folders/1RHpXlosqzsOiVkWosqg-BXKmNWW-QRJ5"
        }
      ]
    },
    {
      "id": "iaas-seguridad-paciente",
      "nombre": "IAAS y seguridad del paciente",
      "icono": "health_and_safety",
      "descripcion": "Prevención de infecciones, eventos adversos y exposición del personal.",
      "documentos": [
        {
          "id": "prevencion-control-iaas",
          "titulo": "Prevención y control de IAAS",
          "codigo": "GCL",
          "url": "https://drive.google.com/drive/folders/1rlAfY6gDHt65yMv0L5kUS4LWUtlr4Hmu"
        },
        {
          "id": "eventos-adversos",
          "titulo": "Eventos adversos",
          "codigo": "GCL",
          "url": "https://drive.google.com/drive/folders/1MbpCgPiau0EP13X4hBr7q9jFFzAV3mwb"
        },
        {
          "id": "vigilancia-eventos-adversos",
          "titulo": "Vigilancia de eventos adversos",
          "codigo": "GCL",
          "url": "https://drive.google.com/drive/folders/1gBX-H8Lu08sc-ZkPJcD5WFAxuGtF7VWk"
        },
        {
          "id": "accidentes-cortopunzantes",
          "titulo": "Accidentes cortopunzantes",
          "codigo": "RH",
          "url": "https://drive.google.com/drive/folders/18D96txhyVEhkWQ5uuJkFec4qLTuJy4Ab"
        }
      ]
    },
    {
      "id": "registros-traslados",
      "nombre": "Registros y traslados",
      "icono": "description",
      "descripcion": "Ficha clínica, registros estandarizados y transporte de pacientes.",
      "documentos": [
        {
          "id": "ficha-clinica-unica",
          "titulo": "Ficha clínica única",
          "codigo": "REG",
          "url": "https://drive.google.com/drive/folders/19ZzqEHCkPMJ9DptBSjfK1_F5rQCwZ3R1"
        },
        {
          "id": "registros-clinicos-estandarizados",
          "titulo": "Registros clínicos estandarizados",
          "codigo": "REG",
          "url": "https://drive.google.com/drive/folders/1XtKr8KBqgUCKH-zM1Yesnj7xHEo79ZYh"
        },
        {
          "id": "transporte-pacientes",
          "titulo": "Transporte de pacientes",
          "codigo": "AP",
          "url": "https://drive.google.com/drive/folders/1FKsoPx4ayQbr8qpVSORNvF1WFjkg0e7W"
        }
      ]
    }
  ]
};
