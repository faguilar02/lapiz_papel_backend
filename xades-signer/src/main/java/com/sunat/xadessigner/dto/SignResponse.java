package com.sunat.xadessigner.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Response DTO para la firma XAdES de documentos UBL
 */
public class SignResponse {
    
    @JsonProperty("signedXml")
    private String signedXml;
    
    @JsonProperty("error")
    private String error;
    
    public SignResponse() {}
    
    public SignResponse(String signedXml) {
        this.signedXml = signedXml;
    }
    
    public static SignResponse success(String signedXml) {
        return new SignResponse(signedXml);
    }
    
    public static SignResponse error(String error) {
        SignResponse response = new SignResponse();
        response.error = error;
        return response;
    }
    
    public String getSignedXml() {
        return signedXml;
    }
    
    public void setSignedXml(String signedXml) {
        this.signedXml = signedXml;
    }
    
    public String getError() {
        return error;
    }
    
    public void setError(String error) {
        this.error = error;
    }
}