#[macro_use] extern crate rocket;

use rocket::fs::{FileServer, relative};
use rocket::serde::json::Json;
use rocket::serde::{Serialize};

#[derive(Serialize)]
struct Status {
    server: &'static str,
    status: &'static str,
    note: &'static str,
}

#[get("/status")]
fn status() -> Json<Status> {
    Json(Status {
        server: "Vangelis-Backend",
        status: "OK",
        note: "Audio synthesizer server running with WebAssembly support"
    })
}

#[launch]
fn rocket() -> _ {
    rocket::build()
        .mount("/", FileServer::from(relative!("../frontend/dist")))
        .mount("/api", routes![status])
}
