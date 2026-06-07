package main

import (
	"fmt"

	"github.com/Kynettic-org/kynettic-backend/docs"
	swaggerFiles "github.com/swaggo/files"
	"github.com/swaggo/swag"
)

func main() {
	// Check if docs are registered
	name := docs.SwaggerInfo.InstanceName()
	doc := swag.GetSwagger(name)
	if doc == nil {
		fmt.Println("ERROR: Swagger doc not found in registry")
	} else {
		fmt.Printf("SUCCESS: Swagger doc found: %s\n", name)
	}

	// Check swaggerFiles assets via the provided HTTP filesystem
	f, err := swaggerFiles.HTTP.Open("/index.html")
	if err != nil {
		f, err = swaggerFiles.HTTP.Open("index.html")
	}
	if err != nil {
		fmt.Printf("ERROR: Could not open index.html from swaggerFiles: %v\n", err)
	} else {
		stat, _ := f.Stat()
		fmt.Printf("SUCCESS: Found index.html in swaggerFiles (size: %d)\n", stat.Size())
		f.Close()
	}

	// Check if we can open it via HTTP FileSystem again (sanity)
	f2, err := swaggerFiles.HTTP.Open("/index.html")
	if err != nil {
		f2, err = swaggerFiles.HTTP.Open("index.html")
	}

	if err != nil {
		fmt.Printf("ERROR: HTTP FileSystem open failed: %v\n", err)
	} else {
		fmt.Println("SUCCESS: HTTP FileSystem open success")
		f2.Close()
	}
}
