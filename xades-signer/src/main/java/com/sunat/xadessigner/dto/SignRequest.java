package com.sunat.xadessigner.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Request DTO para la firma XAdES de documentos UBL
 * Soporta dos modos: 
 * 1. p12Base64 + password (para desarrollo/testing)
 * 2. keyAlias (para producción con certificados seguros)
 */
public class SignRequest {
    
    @JsonProperty("xml")
    private String xml;
    
    @JsonProperty("p12Base64")
    private String p12Base64;
    
    @JsonProperty("password")
    private String password;
    
    @JsonProperty("keyAlias")
    private String keyAlias;
    
    public SignRequest() {}
    
    public SignRequest(String xml, String p12Base64, String password) {
        this.xml = xml;
        this.p12Base64 = p12Base64;
        this.password = password;
    }
    
    public SignRequest(String xml, String keyAlias) {
        this.xml = xml;
        this.keyAlias = keyAlias;
    }
    
    /**
     * Valida que la petición tenga los campos necesarios
     */
    public boolean isValid() {
        if (xml == null || xml.trim().isEmpty()) {
            return false;
        }
        
        // Debe tener o bien p12Base64+password o keyAlias
        boolean hasP12Mode = p12Base64 != null && !p12Base64.trim().isEmpty() && password != null;
        boolean hasAliasMode = keyAlias != null && !keyAlias.trim().isEmpty();
        
        return hasP12Mode || hasAliasMode;
    }
    
    /**
     * Indica si la petición usa el modo de alias (más seguro)
     */
    public boolean isAliasMode() {
        return keyAlias != null && !keyAlias.trim().isEmpty();
    }
    
    // Getters y setters
    public String getXml() {
        return xml;
    }
    
    public void setXml(String xml) {
        this.xml = xml;
    }
    
    public String getP12Base64() {
        return p12Base64;
    }
    
    public void setP12Base64(String p12Base64) {
        this.p12Base64 = p12Base64;
    }
    
    public String getPassword() {
        return password;
    }
    
    public void setPassword(String password) {
        this.password = password;
    }
    
    public String getKeyAlias() {
        return keyAlias;
    }
    
    public void setKeyAlias(String keyAlias) {
        this.keyAlias = keyAlias;
    }
}