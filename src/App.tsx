// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React from "react";
import "./App.css";
import AWS from "aws-sdk";
import { AWS_CONFIG } from "./awsConfig";
import Search from "./search/Search";
import Kendra from "aws-sdk/clients/kendra";
import S3 from "aws-sdk/clients/s3";
import searchlogo from "./searchConsoleArt.svg";
import { facetConfiguration } from "./search/configuration";
import img_logo from "./logo.jpg";
const indexId = process.env.REACT_APP_INDEX_ID!;
const region = process.env.REACT_APP_REGION!;
const url = process.env.REACT_APP_URL_LAMBDA!;

interface AppState {
  kendra?: Kendra;
  s3?: S3;
  username: string;
  password: string;
  tokenExistAndStillValid: boolean;
  loading: boolean;
}

class App extends React.Component<string[], AppState> {
  constructor(props: string[]) {
    super(props);
    this.state = {
      kendra: undefined,
      s3: undefined,
      username: "",
      password: "",
      tokenExistAndStillValid: false,
      loading: false,
    };
  }

  //funcion para poder convertir el token y obtener el username y la fecha de expiracion
  parseJwt = (tokenP: any) => {
    if (tokenP) {
      const base64Url: String = tokenP.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+")?.replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        window
          .atob(base64)
          .split("")
          .map(function (c) {
            return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join("")
      );

      return JSON.parse(jsonPayload);
    }
  };

  //funcion para poder hacer el login haciendo post a la API
  handdleLogin = (e: any) => {
    this.setState({ loading: true });
    e.preventDefault();

    const data = {
      username: this.state.username,
      password: this.state.password,
    };
    localStorage.setItem("user", this.state.username);

//  fetch post
fetch(url, {
  method: "POST",
  body: JSON.stringify(data),
  headers: {
    "Content-type": "application/json; charset=UTF-8",
  },
})
  .then((res) => {
    if (res.status === 401) {
      // Si el estado es 401, mostrar un mensaje de acceso no autorizado
      alert("Acceso no autorizado. Verifica tus credenciales.");
      this.setState({ loading: false });
      throw new Error("Acceso no autorizado"); // Lanzar un error para detener el flujo
    }
    return res.json(); // Continuar procesando la respuesta si el estado no es 401
  })
  .then((data) => {
    if (
      !(
        data.token === undefined ||
        data.token === null ||
        data.status === "403" ||
        this.state.username === "" ||
        this.state.password === ""
      )
    ) {
      AWS.config.update(AWS_CONFIG);
      // Se guarda el token de JWT y de STS en el localstorage
      localStorage.setItem(
        "credenciales",
        JSON.stringify(data.credentials)
      );
      localStorage.setItem("token", data.token);
      window.location.reload();
      this.setState({ loading: false });
    } else {
      alert("Usuario o contraseña incorrectos");
      this.setState({ loading: false });
    }
  })
  .catch((err) => console.log(err));
  }

  //funcion para poder verificar si el token sigue siendo valido o no y asi poder mostrar el login o el search
  async componentDidMount() {
    if (localStorage.getItem("token")) {
      const token = localStorage.getItem("token");
      const tokenExp = this.parseJwt(token).exp;
      const now = Date.now() / 1000;

      if (tokenExp > now) {
        this.setState({ tokenExistAndStillValid: true });
        const data2 = JSON.parse(localStorage.getItem("credenciales")!);
        if (data2) {
          //S3 is required to get signed URLs for S3 objects
          let s3 = new S3({
            accessKeyId: data2.AccessKeyId,
            secretAccessKey: data2.SecretAccessKey,
            sessionToken: data2.SessionToken,
            signatureVersion: "v4",
            region: region,
          });
          let kendra = new Kendra({
            accessKeyId: data2.AccessKeyId,
            secretAccessKey: data2.SecretAccessKey,
            sessionToken: data2.SessionToken,
            signatureVersion: "v4",
            region: region,
          });
          //S3 is required to get signed URLs for S3 objects
          this.setState({
            kendra: kendra,
            s3: s3,
          });
        }
      }
    }
  }

  //funcion para poder hacer el logout y limpiar el localstorage
  handleLogout = () => {
    localStorage.clear();
    window.location.reload();
  };

  //funcion para poder renderizar el search o el login
  render(): React.ReactNode {
    return (
      <>
        <div className="fondo"></div>
        <div className="App">
          {/*si el token existe y sigue siendo valido se muestra el search, si no se muestra el login */}
          {this.state.tokenExistAndStillValid ? (
            <div className="logged">
              <div className="navbar">
                <img src={img_logo} width={200} alt={"Logo"} />
                <div className="logout">
                  <p>Hello, {localStorage.getItem("user")}</p>
                  <button onClick={this.handleLogout}>Logout</button>
                </div>
              </div>

              <div className="searchBox">
                <div style={{ textAlign: "center" }}>
                  <img src={searchlogo} alt="Search Logo" />
                </div>
                {this.state.kendra && this.state.s3 && (
                  <Search
                    kendra={this.state.kendra}
                    indexId={indexId}
                    s3={this.state.s3}
                    accessToken={localStorage.getItem("token")!}
                    facetConfiguration={facetConfiguration}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="login">
              <h3>Sign in to your account</h3>

              <form action="">
                <label>
                  <p>Username * </p>

                  <input
                    name="myInput"
                    placeholder="Enter your username"
                    onChange={(event) => {
                      this.setState({ username: event.target.value });
                    }}
                  />
                </label>

                <label>
                  <p>Password * </p>

                  <input
                    name="myInput"
                    type="password"
                    placeholder="Enter your password"
                    onChange={(event) => {
                      this.setState({ password: event.target.value });
                    }}
                  />
                </label>

                <button
                  disabled={this.state.loading}
                  onClick={this.handdleLogin}
                >
                  SIGN IN
                </button>
              </form>
            </div>
          )}
        </div>
      </>
    );
  }
}

export default App;
