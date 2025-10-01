package com.sunat.xadessigner.controller;

import com.sunat.xadessigner.dto.SignRequest;
import com.sunat.xadessigner.dto.SignResponse;
import com.sunat.xadessigner.service.XadesSignerService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Controlador para operaciones de firma XAdES
 */
@RestController
public class SignController {
    
    private static final Logger logger = LoggerFactory.getLogger(SignController.class);
    
    @Autowired
    private XadesSignerService xadesSignerService;
    
    /**
     * Health check endpoint
     */
    @GetMapping("/health")
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("OK");
    }
    
    /**
     * Endpoint para firmar documentos UBL con XAdES-BES
     */
    @PostMapping("/sign-xades")
    public ResponseEntity<SignResponse> signXades(@RequestBody SignRequest request) {
        logger.info("Recibida solicitud de firma XAdES - Modo: {}", 
                   request.isAliasMode() ? "alias(" + request.getKeyAlias() + ")" : "p12Base64");
        
        try {
            // Validar entrada usando el método del DTO
            if (!request.isValid()) {
                return ResponseEntity.badRequest()
                    .body(SignResponse.error("Petición inválida. Debe proporcionar 'xml' y ('p12Base64'+'password' o 'keyAlias')"));
            }
            
            String signedXml;
            
            if (request.isAliasMode()) {
                // Modo seguro: usar alias de certificado
                signedXml = xadesSignerService.signUblWithAlias(request.getXml(), request.getKeyAlias());
            } else {
                // Modo desarrollo: usar p12Base64
                signedXml = xadesSignerService.signUbl(request.getXml(), request.getP12Base64(), request.getPassword());
            }
            
            logger.info("Documento firmado exitosamente - Tamaño: {} caracteres", signedXml.length());
            
            // Log de algoritmos usados (solo en DEBUG)
            if (logger.isDebugEnabled()) {
                logger.debug(xadesSignerService.getSignatureAlgorithmsInfo(signedXml));
            }
            
            return ResponseEntity.ok(SignResponse.success(signedXml));
            
        } catch (IllegalArgumentException e) {
            logger.error("Error de validación: {}", e.getMessage());
            return ResponseEntity.badRequest()
                .body(SignResponse.error(e.getMessage()));
                
        } catch (Exception e) {
            logger.error("Error interno al firmar documento: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(SignResponse.error("Error interno al procesar la firma"));
        }
    }
}